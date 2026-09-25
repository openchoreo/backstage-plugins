import type { Entity } from '@backstage/catalog-model';
import type {
  HookParameter,
  HookSpec,
} from '@openchoreo/backstage-plugin-common';

/** Reads the CRD spec the catalog provider stores on a Hook / ClusterHook entity. */
export function readHookSpec(entity: Entity): HookSpec | undefined {
  const spec = entity.spec as Partial<HookSpec> | undefined;
  if (!spec || !spec.workflowRef) return undefined;
  return spec as HookSpec;
}

export type HookParameterSource =
  | 'fixed'
  | 'from-release'
  | 'from-release-overridable'
  | 'default'
  | 'required';

/**
 * Classifies a parameter by the single source the webhook allows it to have.
 * The label the card shows comes from this so every surface agrees.
 */
export function parameterSource(p: HookParameter): HookParameterSource {
  if (p.value !== undefined) return 'fixed';
  if (p.from)
    return p.overridable ? 'from-release-overridable' : 'from-release';
  if (p.default !== undefined) return 'default';
  return 'required';
}

export const PARAMETER_SOURCE_LABELS: Record<HookParameterSource, string> = {
  fixed: 'fixed',
  'from-release': 'from release',
  'from-release-overridable': 'from release · overridable',
  default: 'default · overridable',
  required: 'required',
};

export function parameterValue(p: HookParameter): string {
  if (p.value !== undefined) return p.value;
  if (p.from) return p.from;
  if (p.default !== undefined) return p.default;
  return '—';
}

/** Entity ref of the workflow a hook runs, derived from its spec. */
export function workflowEntityRef(entity: Entity, spec: HookSpec): string {
  const kind = spec.workflowRef.kind ?? 'ClusterWorkflow';
  if (kind === 'ClusterWorkflow') {
    return `clusterworkflow:openchoreo-cluster/${spec.workflowRef.name}`;
  }
  const ns = entity.metadata.namespace || 'default';
  return `workflow:${ns}/${spec.workflowRef.name}`;
}
