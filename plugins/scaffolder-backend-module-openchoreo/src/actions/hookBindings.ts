/**
 * Deployment hooks (alpha): one hook binding on an environment, as the
 * Environment CRD declares it. Passed through to the API untouched; the
 * control plane's webhook validates it.
 */
const hookBindingSchema = (z: any) =>
  z.object({
    name: z.string(),
    hookRef: z.object({
      kind: z.enum(['Hook', 'ClusterHook']).optional(),
      name: z.string(),
    }),
    mode: z.enum(['Sync', 'Async']).optional(),
    parameters: z.record(z.string()).optional(),
    appliesTo: z
      .array(
        z.object({
          kind: z.enum(['ComponentType', 'ClusterComponentType']),
          name: z.string(),
        }),
      )
      .optional(),
    onFailure: z.enum(['Block', 'Ignore', 'Alert']).optional(),
    timeout: z.string().optional(),
    retries: z.number().int().min(0).max(5).optional(),
    // Form-only snapshot of the hook (portal validation); ignored here and
    // never sent to the API.
    hookSpec: z.unknown().optional(),
  });

export const hookSetSchema = (z: any) =>
  z
    .object({
      preDeploy: z.array(hookBindingSchema(z)).optional(),
      postDeploy: z.array(hookBindingSchema(z)).optional(),
    })
    .optional();

type HookBindingInput = {
  name: string;
  hookRef: { kind?: 'Hook' | 'ClusterHook'; name: string };
  mode?: 'Sync' | 'Async';
  parameters?: Record<string, string>;
  appliesTo?: Array<{
    kind: 'ComponentType' | 'ClusterComponentType';
    name: string;
  }>;
  onFailure?: 'Block' | 'Ignore' | 'Alert';
  timeout?: string;
  retries?: number;
};

export type HookSetInput = {
  preDeploy?: HookBindingInput[];
  postDeploy?: HookBindingInput[];
};

/**
 * The generated client marks CRD-defaulted binding fields as required; fill
 * the same defaults the CRD applies so the request body type-checks without
 * changing what the control plane stores.
 */
const toApiBinding = (b: HookBindingInput) => {
  // The form keeps "" for parameters left blank; sending them would override
  // the hook's default with an empty value, so drop them (as the YAML view does).
  const parameters = Object.fromEntries(
    Object.entries(b.parameters ?? {}).filter(([, v]) => v !== ''),
  );
  return {
    name: b.name,
    hookRef: {
      kind: b.hookRef.kind ?? ('Hook' as const),
      name: b.hookRef.name,
    },
    mode: b.mode ?? ('Sync' as const),
    ...(Object.keys(parameters).length > 0 ? { parameters } : {}),
    ...(b.appliesTo ? { appliesTo: b.appliesTo } : {}),
    ...(b.onFailure ? { onFailure: b.onFailure } : {}),
    ...(b.timeout ? { timeout: b.timeout } : {}),
    retries: b.retries ?? 0,
  };
};

export const toApiHookSet = (hooks?: HookSetInput) => {
  if (!hooks) return undefined;
  const out: {
    preDeploy?: ReturnType<typeof toApiBinding>[];
    postDeploy?: ReturnType<typeof toApiBinding>[];
  } = {};
  if (hooks.preDeploy?.length)
    out.preDeploy = hooks.preDeploy.map(toApiBinding);
  if (hooks.postDeploy?.length)
    out.postDeploy = hooks.postDeploy.map(toApiBinding);
  return Object.keys(out).length > 0 ? out : undefined;
};
