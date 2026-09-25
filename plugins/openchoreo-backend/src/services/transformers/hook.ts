import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';
import type {
  ClusterHookResponse,
  HookResponse,
  HookSpec,
} from '@openchoreo/backstage-plugin-common';
import {
  getName,
  getNamespace,
  getCreatedAt,
  getDisplayName,
  getDescription,
} from './common';

type Hook = OpenChoreoComponents['schemas']['Hook'];
type ClusterHook = OpenChoreoComponents['schemas']['ClusterHook'];
type ApiHookSpec = OpenChoreoComponents['schemas']['HookSpec'];

/**
 * Carries the CRD spec through unchanged. The parameter mapping is the whole
 * point of a hook, so nothing is dropped or flattened here.
 */
export function toHookSpec(spec: ApiHookSpec | undefined): HookSpec {
  return {
    type: spec?.type,
    workflowRef: {
      kind: spec?.workflowRef?.kind ?? 'ClusterWorkflow',
      name: spec?.workflowRef?.name ?? '',
    },
    parameters: spec?.parameters?.map(p => ({
      name: p.name,
      ...(p.value !== undefined && { value: p.value }),
      ...(p.from !== undefined && { from: p.from }),
      ...(p.default !== undefined && { default: p.default }),
      ...(p.overridable !== undefined && { overridable: p.overridable }),
      ...(p.required !== undefined && { required: p.required }),
      ...(p.schema !== undefined && {
        schema: p.schema as Record<string, unknown>,
      }),
    })),
    enabledTo: spec?.enabledTo?.map(e => ({ kind: e.kind, name: e.name })),
  };
}

export function transformHook(hook: Hook): HookResponse {
  return {
    name: getName(hook) ?? '',
    namespaceName: getNamespace(hook) ?? '',
    displayName: getDisplayName(hook),
    description: getDescription(hook),
    createdAt: getCreatedAt(hook) ?? '',
    spec: toHookSpec(hook.spec),
  };
}

export function transformClusterHook(hook: ClusterHook): ClusterHookResponse {
  return {
    name: getName(hook) ?? '',
    displayName: getDisplayName(hook),
    description: getDescription(hook),
    createdAt: getCreatedAt(hook) ?? '',
    spec: toHookSpec(hook.spec),
  };
}
