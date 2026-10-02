import YAML from 'yaml';

/** Which of the two hook kinds a form instance produces. */
export type HookScope = 'namespace' | 'cluster';

export type HookParameterSourceOption =
  | 'value'
  | 'from'
  | 'default'
  | 'required';

export interface HookParameterFormRow {
  name: string;
  source: HookParameterSourceOption;
  /** Literal for `value`, CEL for `from`, default for `default`; ignored for `required`. */
  value: string;
  /** Only meaningful with `from`. */
  overridable: boolean;
}

export interface HookEnabledToFormRow {
  kind: 'ComponentType' | 'ClusterComponentType';
  name: string;
}

export interface HookFormData {
  hook_name: string;
  /** Namespace entity ref (`domain:default/<ns>`); unused for ClusterHook. */
  namespace_name: string;
  displayName: string;
  description: string;
  workflowKind: 'Workflow' | 'ClusterWorkflow';
  workflowName: string;
  parameters: HookParameterFormRow[];
  enabledTo: HookEnabledToFormRow[];
  /** The rendered CRD; kept in sync with the fields so the template can post it. */
  yamlContent: string;
}

export const DEFAULT_FORM_DATA: HookFormData = {
  hook_name: '',
  namespace_name: '',
  displayName: '',
  description: '',
  workflowKind: 'ClusterWorkflow',
  workflowName: '',
  parameters: [],
  enabledTo: [],
  yamlContent: '',
};

export const PARAMETER_SOURCE_LABELS: Record<
  HookParameterSourceOption,
  string
> = {
  value: 'Fixed value',
  from: 'From release',
  default: 'Default',
  required: 'Required',
};

/** `${deployment.…}` paths the controller exposes to `from` expressions. */
export const DEPLOYMENT_CONTEXT_PATHS: Array<{ path: string; hint: string }> = [
  { path: 'deployment.release', hint: 'ComponentRelease name' },
  { path: 'deployment.component.name', hint: 'component name' },
  { path: 'deployment.component.labels', hint: 'component labels (map)' },
  { path: 'deployment.component.annotations', hint: 'component annotations' },
  {
    path: 'deployment.component.parameters',
    hint: 'typed component parameters',
  },
  { path: 'deployment.componentType', hint: '{kind, name}' },
  { path: 'deployment.projectType', hint: '{kind, name}' },
  {
    path: 'deployment.workload.containers.<name>.image',
    hint: 'container image',
  },
  { path: 'deployment.environment.name', hint: 'target environment' },
  { path: 'deployment.environment.isProduction', hint: 'true/false' },
  { path: 'deployment.project.name', hint: 'project name' },
  {
    path: 'deployment.trigger',
    hint: 'ReleaseChange | BindingCreate | ConfigChange',
  },
  {
    path: 'deployment.endpoints',
    hint: 'resolved endpoint URLs (post-deploy)',
  },
];

export const K8S_NAME_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
export const PARAMETER_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

export function extractName(entityRef: string): string {
  const parts = entityRef.split('/');
  return parts[parts.length - 1];
}

/**
 * Mirrors the Hook admission webhook so the form never submits what the
 * API would reject. Returns human-readable messages; empty means valid.
 */
export function validateHookForm(
  data: Partial<HookFormData> | undefined,
  scope: HookScope,
): string[] {
  const errors: string[] = [];
  const d = { ...DEFAULT_FORM_DATA, ...(data ?? {}) };

  if (!d.hook_name.trim()) {
    errors.push('Hook name is required');
  } else if (!K8S_NAME_PATTERN.test(d.hook_name)) {
    errors.push(
      'Hook name must be lowercase alphanumeric with hyphens, starting and ending with alphanumeric',
    );
  }
  if (scope === 'namespace' && !d.namespace_name.trim()) {
    errors.push('Namespace is required');
  }
  if (!d.workflowName.trim()) {
    errors.push('A workflow is required');
  }
  if (scope === 'cluster' && d.workflowKind !== 'ClusterWorkflow') {
    errors.push('A ClusterHook may only reference a ClusterWorkflow');
  }

  const seen = new Set<string>();
  d.parameters.forEach((p, i) => {
    const label = p.name ? `Parameter "${p.name}"` : `Parameter ${i + 1}`;
    if (!p.name.trim()) {
      errors.push(`${label}: name is required`);
    } else if (!PARAMETER_NAME_PATTERN.test(p.name)) {
      errors.push(
        `${label}: name must start with a letter and contain only letters, digits, _ or -`,
      );
    } else if (seen.has(p.name)) {
      errors.push(`${label}: duplicate parameter name`);
    }
    seen.add(p.name);

    if (p.source === 'from') {
      if (!p.value.trim()) {
        errors.push(`${label}: a "from" expression is required`);
      } else if (!/\$\{[^}]+\}/.test(p.value)) {
        errors.push(
          `${label}: "from" must contain a \${…} expression over the deployment context`,
        );
      }
    }
    if (p.overridable && p.source !== 'from') {
      errors.push(`${label}: "overridable" only applies to a "from" source`);
    }
  });

  const seenEnabled = new Set<string>();
  d.enabledTo.forEach((e, i) => {
    const key = `${e.kind}/${e.name}`;
    if (!e.name.trim()) {
      errors.push(`Enabled for entry ${i + 1}: a type name is required`);
    } else if (seenEnabled.has(key)) {
      errors.push(`Enabled for: ${key} is listed twice`);
    }
    seenEnabled.add(key);
  });

  return errors;
}

function rowToParameter(p: HookParameterFormRow): Record<string, unknown> {
  const out: Record<string, unknown> = { name: p.name };
  switch (p.source) {
    case 'value':
      out.value = p.value;
      break;
    case 'from':
      out.from = p.value;
      if (p.overridable) out.overridable = true;
      break;
    case 'default':
      out.default = p.value;
      break;
    case 'required':
      out.required = true;
      break;
    default:
      break;
  }
  return out;
}

export function buildHookResource(
  data: HookFormData,
  scope: HookScope,
): Record<string, unknown> {
  const annotations: Record<string, string> = {};
  if (data.displayName)
    annotations['openchoreo.dev/display-name'] = data.displayName;
  if (data.description)
    annotations['openchoreo.dev/description'] = data.description;

  const metadata: Record<string, unknown> = { name: data.hook_name };
  if (scope === 'namespace') {
    metadata.namespace = data.namespace_name
      ? extractName(data.namespace_name)
      : '';
  }
  if (Object.keys(annotations).length > 0) metadata.annotations = annotations;

  const spec: Record<string, unknown> = {
    type: 'Workflow',
    workflowRef: {
      kind: scope === 'cluster' ? 'ClusterWorkflow' : data.workflowKind,
      name: data.workflowName,
    },
  };
  if (data.enabledTo.length > 0) {
    spec.enabledTo = data.enabledTo.map(e => ({ kind: e.kind, name: e.name }));
  }
  if (data.parameters.length > 0) {
    spec.parameters = data.parameters.map(rowToParameter);
  }

  return {
    apiVersion: 'openchoreo.dev/v1alpha1',
    kind: scope === 'cluster' ? 'ClusterHook' : 'Hook',
    metadata,
    spec,
  };
}

export function formToYaml(data: HookFormData, scope: HookScope): string {
  return YAML.stringify(buildHookResource(data, scope), { indent: 2 });
}

function parameterToRow(p: any): HookParameterFormRow {
  if (p?.value !== undefined && p.value !== null) {
    return {
      name: p.name ?? '',
      source: 'value',
      value: String(p.value),
      overridable: false,
    };
  }
  if (p?.from) {
    return {
      name: p.name ?? '',
      source: 'from',
      value: String(p.from),
      overridable: !!p.overridable,
    };
  }
  if (p?.default !== undefined && p.default !== null) {
    return {
      name: p.name ?? '',
      source: 'default',
      value: String(p.default),
      overridable: false,
    };
  }
  return {
    name: p?.name ?? '',
    source: 'required',
    value: '',
    overridable: false,
  };
}

/**
 * Inverse of {@link formToYaml}. Namespace refs are re-resolved against the
 * loaded namespace list so the select shows the right option.
 */
export function yamlToForm(
  yamlContent: string,
  scope: HookScope,
  namespaces: Array<{ name: string; entityRef: string }>,
): Partial<HookFormData> {
  const parsed = YAML.parse(yamlContent);
  if (!parsed || typeof parsed !== 'object') return {};

  const namespaceName = parsed.metadata?.namespace || '';
  const matched = namespaces.find(
    ns => extractName(ns.entityRef) === namespaceName,
  );
  const workflowRef = parsed.spec?.workflowRef ?? {};

  const result: Partial<HookFormData> = {
    hook_name: parsed.metadata?.name || '',
    displayName:
      parsed.metadata?.annotations?.['openchoreo.dev/display-name'] || '',
    description:
      parsed.metadata?.annotations?.['openchoreo.dev/description'] || '',
    workflowKind:
      workflowRef.kind === 'Workflow' && scope === 'namespace'
        ? 'Workflow'
        : 'ClusterWorkflow',
    workflowName: workflowRef.name || '',
    parameters: Array.isArray(parsed.spec?.parameters)
      ? parsed.spec.parameters.map(parameterToRow)
      : [],
    enabledTo: Array.isArray(parsed.spec?.enabledTo)
      ? parsed.spec.enabledTo.map((e: any) => ({
          kind:
            e?.kind === 'ComponentType'
              ? 'ComponentType'
              : 'ClusterComponentType',
          name: e?.name ?? '',
        }))
      : [],
  };
  if (scope === 'namespace') {
    result.namespace_name =
      matched?.entityRef || (namespaceName ? namespaceName : '');
  }
  return result;
}

/** Flattened view of a workflow's parameter schema. */
export interface WorkflowSchemaSummary {
  /** Dot paths of leaf inputs, e.g. `image`, `repository.url`. */
  properties: string[];
  /** Top-level inputs the schema marks required. */
  required: string[];
}

/**
 * Flattens `parameters.openAPIV3Schema` (as served by the workflow schema
 * endpoints, optionally wrapped in a `parameters` property) to the input
 * names a hook may map. Nested objects contribute `parent.child` paths.
 */
export function summarizeWorkflowSchema(schema: any): WorkflowSchemaSummary {
  let root = schema;
  if (root?.properties?.parameters?.properties) {
    root = root.properties.parameters;
  }
  const properties: string[] = [];
  const walk = (node: any, prefix: string) => {
    const props = node?.properties;
    if (!props || typeof props !== 'object') return;
    for (const [key, value] of Object.entries<any>(props)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (value?.type === 'object' && value?.properties) {
        walk(value, path);
      } else {
        properties.push(path);
      }
    }
  };
  walk(root, '');
  const required = Array.isArray(root?.required)
    ? root.required.filter((r: unknown): r is string => typeof r === 'string')
    : [];
  return { properties, required };
}

/** Schema-required inputs that no parameter row maps yet. */
export function unmappedRequiredInputs(
  summary: WorkflowSchemaSummary | undefined,
  parameters: HookParameterFormRow[],
): string[] {
  if (!summary) return [];
  const mapped = new Set(parameters.map(p => p.name));
  return summary.required.filter(r => !mapped.has(r));
}
