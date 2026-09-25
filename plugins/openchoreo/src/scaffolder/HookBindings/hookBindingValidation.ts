import type {
  HookFailurePolicy,
  HookMode,
  HookParameter,
  HookRefKind,
  HookSubjectRef,
  HookSubjectSelector,
  HookSubjectSelectorKind,
} from '@openchoreo/backstage-plugin-common';

/**
 * Deployment hooks (alpha) — form model, YAML mapping and client-side
 * validation for the hook bindings a DeploymentPipeline carries on each
 * environment. The rules here mirror the control plane's
 * DeploymentPipeline webhook so the form never submits a binding the API
 * would reject.
 */

export type HookPhase = 'preDeploy' | 'postDeploy';

export const HOOK_MODES: HookMode[] = ['Sync', 'Async'];
export const DEFAULT_TIMEOUT = '30m';
export const BINDING_NAME_PATTERN = /^[a-z]([-a-z0-9]*[a-z0-9])?$/;
export const BINDING_NAME_MAX_LENGTH = 40;
export const TIMEOUT_PATTERN = /^(\d+h)?(\d+m)?(\d+s)?$/;
export const MAX_RETRIES = 5;

/** onFailure policies the webhook accepts per phase; the first is the default. */
export const FAILURE_POLICIES_BY_PHASE: Record<HookPhase, HookFailurePolicy[]> =
  {
    preDeploy: ['Block', 'Ignore'],
    postDeploy: ['Ignore', 'Alert'],
  };

/** A hook as the form sees it: catalog identity plus the CRD spec bits it needs. */
export interface HookOption {
  kind: HookRefKind;
  name: string;
  /** OpenChoreo namespace for `Hook`; undefined for `ClusterHook`. */
  namespace?: string;
  displayName?: string;
  parameters: HookParameter[];
  enabledTo: HookSubjectRef[];
}

/** A component or project type the `appliesTo` selector can name. */
export interface SubjectTypeOption {
  kind: HookSubjectSelectorKind;
  name: string;
}

export interface HookBindingFormData {
  name: string;
  hookRef: { kind: HookRefKind; name: string };
  mode: HookMode;
  onFailure?: HookFailurePolicy;
  timeout?: string;
  retries?: number;
  appliesTo: HookSubjectSelector[];
  parameters: Record<string, string>;
  /**
   * Form-only snapshot of the selected hook, so submit-time validation (which
   * has no catalog access) can apply the parameter and enabledTo rules. Never
   * written to the Environment YAML.
   */
  hookSpec?: HookOption;
}

export interface HookSetFormData {
  preDeploy: HookBindingFormData[];
  postDeploy: HookBindingFormData[];
}

export const EMPTY_HOOK_SET: HookSetFormData = {
  preDeploy: [],
  postDeploy: [],
};

export function hookOptionKey(ref: { kind: HookRefKind; name: string }) {
  return `${ref.kind}/${ref.name}`;
}

/**
 * The binding name defaults to the hook's name (already DNS-safe) so a
 * platform engineer usually never types one; they only rename to bind the
 * same hook twice on one environment.
 */
export function deriveBindingName(hookName: string): string {
  return hookName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, BINDING_NAME_MAX_LENGTH)
    .replace(/-+$/g, '');
}

export function newBinding(
  hook: HookOption,
  phase: HookPhase,
): HookBindingFormData {
  return {
    name: deriveBindingName(hook.name),
    hookRef: { kind: hook.kind, name: hook.name },
    mode: 'Sync',
    onFailure: FAILURE_POLICIES_BY_PHASE[phase][0],
    timeout: DEFAULT_TIMEOUT,
    retries: 0,
    appliesTo: [],
    parameters: initialParameters(hook.parameters),
  };
}

// ---------------------------------------------------------------------------
// Parameter mapping
// ---------------------------------------------------------------------------

export type ParameterSource =
  | 'fixed'
  | 'from'
  | 'from-overridable'
  | 'default'
  | 'required';

export interface ParameterRow {
  name: string;
  source: ParameterSource;
  /** Whether the binding may supply a value for this parameter. */
  editable: boolean;
  /** Whether the binding must supply a value for this parameter. */
  mandatory: boolean;
  /** The hook's fixed value, CEL expression or default, for display. */
  hookValue?: string;
}

export function parameterSource(p: HookParameter): ParameterSource {
  if (p.value !== undefined) return 'fixed';
  if (p.from) return p.overridable ? 'from-overridable' : 'from';
  if (p.default !== undefined) return 'default';
  return 'required';
}

/**
 * Rows the binding editor shows for a hook: every parameter is listed so
 * the engineer sees the full mapping, but only `default`, `required` and
 * `from`+`overridable` accept a value — the webhook rejects any other key.
 */
export function parameterRowsForHook(params: HookParameter[]): ParameterRow[] {
  return params.map(p => {
    const source = parameterSource(p);
    return {
      name: p.name,
      source,
      editable:
        source === 'default' ||
        source === 'required' ||
        source === 'from-overridable',
      mandatory: source === 'required',
      hookValue: p.value ?? p.from ?? p.default,
    };
  });
}

/** `default` parameters are prefilled so the emitted YAML documents the value in use. */
export function initialParameters(
  params: HookParameter[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of params) {
    if (parameterSource(p) === 'default' && p.default !== undefined) {
      out[p.name] = p.default;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// appliesTo ⊆ enabledTo
// ---------------------------------------------------------------------------

function isComponentTypeKind(kind: HookSubjectSelectorKind) {
  return kind === 'ComponentType' || kind === 'ClusterComponentType';
}

/**
 * When a hook declares `enabledTo`, a binding can only narrow it. Component
 * type options outside that list are hidden; project types are a different
 * axis and stay available.
 */
export function allowedSubjectTypes(
  options: SubjectTypeOption[],
  enabledTo: HookSubjectRef[],
): SubjectTypeOption[] {
  if (enabledTo.length === 0) return options;
  return options.filter(
    o =>
      !isComponentTypeKind(o.kind) ||
      enabledTo.some(e => e.kind === o.kind && e.name === o.name),
  );
}

export function selectorsOutsideEnabledTo(
  appliesTo: HookSubjectSelector[],
  enabledTo: HookSubjectRef[],
): HookSubjectSelector[] {
  if (enabledTo.length === 0) return [];
  return appliesTo.filter(
    s =>
      isComponentTypeKind(s.kind) &&
      !enabledTo.some(e => e.kind === s.kind && e.name === s.name),
  );
}

// ---------------------------------------------------------------------------
// Validation (mirrors internal/validation/hooks/binding.go)
// ---------------------------------------------------------------------------

export function validateHookBinding(
  b: HookBindingFormData,
  phase: HookPhase,
  siblingNames: string[],
  hook?: HookOption,
): string[] {
  const errors: string[] = [];
  const label = b.name || '(unnamed)';

  if (!b.name) {
    errors.push('Binding name is required');
  } else {
    if (!BINDING_NAME_PATTERN.test(b.name)) {
      errors.push(
        `Binding "${label}": name must be lowercase alphanumeric with hyphens, starting with a letter`,
      );
    }
    if (b.name.length > BINDING_NAME_MAX_LENGTH) {
      errors.push(
        `Binding "${label}": name must be at most ${BINDING_NAME_MAX_LENGTH} characters`,
      );
    }
    if (siblingNames.filter(n => n === b.name).length > 1) {
      errors.push(
        `Binding "${label}": name must be unique across pre-deploy and post-deploy hooks of an environment`,
      );
    }
  }

  if (!b.hookRef?.name) {
    errors.push(`Binding "${label}": a hook must be selected`);
  }

  if (b.mode === 'Async') {
    if (b.onFailure || b.timeout || b.retries) {
      errors.push(
        `Binding "${label}": Async hooks cannot set onFailure, timeout or retries`,
      );
    }
  } else {
    const allowed = FAILURE_POLICIES_BY_PHASE[phase];
    if (b.onFailure && !allowed.includes(b.onFailure)) {
      errors.push(
        `Binding "${label}": onFailure ${b.onFailure} is not allowed for ${
          phase === 'preDeploy' ? 'pre-deploy' : 'post-deploy'
        } hooks (use ${allowed.join(' or ')})`,
      );
    }
    if (b.timeout && (!TIMEOUT_PATTERN.test(b.timeout) || b.timeout === '')) {
      errors.push(
        `Binding "${label}": timeout must be a duration such as 30m or 1h30m`,
      );
    }
    if (
      b.retries !== undefined &&
      (!Number.isInteger(b.retries) || b.retries < 0 || b.retries > MAX_RETRIES)
    ) {
      errors.push(
        `Binding "${label}": retries must be between 0 and ${MAX_RETRIES}`,
      );
    }
  }

  if (hook) {
    const outside = selectorsOutsideEnabledTo(b.appliesTo, hook.enabledTo);
    for (const s of outside) {
      errors.push(
        `Binding "${label}": ${s.kind}/${s.name} is not in the hook's enabledTo list`,
      );
    }

    const rows = parameterRowsForHook(hook.parameters);
    const byName = new Map(rows.map(r => [r.name, r]));
    for (const [key, value] of Object.entries(b.parameters)) {
      const row = byName.get(key);
      if (!row) {
        errors.push(
          `Binding "${label}": parameter "${key}" is not declared by the hook`,
        );
      } else if (!row.editable && value !== '') {
        errors.push(
          `Binding "${label}": parameter "${key}" is ${
            row.source === 'fixed' ? 'fixed' : 'computed'
          } by the hook and cannot be set`,
        );
      }
    }
    for (const row of rows) {
      if (row.mandatory && !b.parameters[row.name]) {
        errors.push(
          `Binding "${label}": parameter "${row.name}" is required by the hook`,
        );
      }
    }
  }

  return errors;
}

/** The binding's hook snapshot, when it is still for the selected hook. */
export function specFor(b: HookBindingFormData): HookOption | undefined {
  const s = b.hookSpec;
  return s && s.kind === (b.hookRef.kind ?? 'Hook') && s.name === b.hookRef.name
    ? s
    : undefined;
}

export function validateHookSet(
  set: HookSetFormData | undefined,
  hooks: HookOption[],
): string[] {
  if (!set) return [];
  const names = [...set.preDeploy, ...set.postDeploy].map(b => b.name);
  const find = (b: HookBindingFormData) =>
    hooks.find(
      h => h.kind === (b.hookRef.kind ?? 'Hook') && h.name === b.hookRef.name,
    ) ?? specFor(b);
  return [
    ...set.preDeploy.flatMap(b =>
      validateHookBinding(b, 'preDeploy', names, find(b)),
    ),
    ...set.postDeploy.flatMap(b =>
      validateHookBinding(b, 'postDeploy', names, find(b)),
    ),
  ];
}

// ---------------------------------------------------------------------------
// YAML mapping — emit only what the CRD needs so the manifest stays readable
// and round-trips byte-for-byte through yamlToForm.
// ---------------------------------------------------------------------------

export interface HookBindingYaml {
  name: string;
  hookRef: { kind: HookRefKind; name: string };
  mode: HookMode;
  onFailure?: HookFailurePolicy;
  timeout?: string;
  retries?: number;
  appliesTo?: HookSubjectSelector[];
  parameters?: Record<string, string>;
}

export function bindingToYaml(b: HookBindingFormData): HookBindingYaml {
  const out: HookBindingYaml = {
    name: b.name,
    hookRef: { kind: b.hookRef.kind, name: b.hookRef.name },
    mode: b.mode,
  };
  if (b.mode === 'Sync') {
    if (b.onFailure) out.onFailure = b.onFailure;
    if (b.timeout) out.timeout = b.timeout;
    if (b.retries) out.retries = b.retries;
  }
  if (b.appliesTo.length > 0) out.appliesTo = b.appliesTo.map(s => ({ ...s }));
  const params = Object.fromEntries(
    Object.entries(b.parameters).filter(([, v]) => v !== ''),
  );
  if (Object.keys(params).length > 0) out.parameters = params;
  return out;
}

export function hookSetToYaml(
  set: HookSetFormData | undefined,
):
  | { preDeploy?: HookBindingYaml[]; postDeploy?: HookBindingYaml[] }
  | undefined {
  if (!set) return undefined;
  const out: { preDeploy?: HookBindingYaml[]; postDeploy?: HookBindingYaml[] } =
    {};
  if (set.preDeploy.length > 0)
    out.preDeploy = set.preDeploy.map(bindingToYaml);
  if (set.postDeploy.length > 0)
    out.postDeploy = set.postDeploy.map(bindingToYaml);
  return Object.keys(out).length > 0 ? out : undefined;
}

function asStringRecord(v: unknown): Record<string, string> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    out[k] = val === undefined || val === null ? '' : String(val);
  }
  return out;
}

export function bindingFromYaml(raw: unknown): HookBindingFormData {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    unknown
  >;
  const hookRef = (
    r.hookRef && typeof r.hookRef === 'object' ? r.hookRef : {}
  ) as { kind?: HookRefKind; name?: string };
  const mode: HookMode = r.mode === 'Async' ? 'Async' : 'Sync';
  const b: HookBindingFormData = {
    name: typeof r.name === 'string' ? r.name : '',
    hookRef: { kind: hookRef.kind ?? 'Hook', name: hookRef.name ?? '' },
    mode,
    appliesTo: Array.isArray(r.appliesTo)
      ? (r.appliesTo as HookSubjectSelector[]).map(s => ({
          kind: s.kind,
          name: s.name,
        }))
      : [],
    parameters: asStringRecord(r.parameters),
  };
  if (mode === 'Sync') {
    if (typeof r.onFailure === 'string')
      b.onFailure = r.onFailure as HookFailurePolicy;
    if (typeof r.timeout === 'string') b.timeout = r.timeout;
    if (typeof r.retries === 'number') b.retries = r.retries;
  }
  return b;
}

export function hookSetFromYaml(raw: unknown): HookSetFormData | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as { preDeploy?: unknown; postDeploy?: unknown };
  const set: HookSetFormData = {
    preDeploy: Array.isArray(r.preDeploy)
      ? r.preDeploy.map(bindingFromYaml)
      : [],
    postDeploy: Array.isArray(r.postDeploy)
      ? r.postDeploy.map(bindingFromYaml)
      : [],
  };
  return set.preDeploy.length + set.postDeploy.length > 0 ? set : undefined;
}
