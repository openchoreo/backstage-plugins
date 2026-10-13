import type { HookBinding, HookSet } from '@openchoreo/backstage-plugin-common';
import type {
  PipelineEnvironmentHook,
  PipelineHookEffect,
} from '@openchoreo/backstage-plugin-react';

/** Catalog namespace cluster-scoped OpenChoreo entities live in. */
const CLUSTER_ENTITY_NAMESPACE = 'openchoreo-cluster';

/** CRD defaults: mode Sync; onFailure Block pre-deploy, Ignore post-deploy. */
function hookEffect(b: HookBinding, phase: 'pre' | 'post'): PipelineHookEffect {
  if ((b.mode ?? 'Sync') === 'Async') return 'background';
  const onFailure = b.onFailure ?? (phase === 'pre' ? 'Block' : 'Ignore');
  if (onFailure === 'Block') return 'blocks';
  if (onFailure === 'Alert') return 'alerts';
  return 'waits';
}

/**
 * One entry per binding of an environment, in webhook order (pre-deploy then
 * post-deploy), linking to the Hook / ClusterHook entity.
 */
export function hooksOfEnvironment(
  hooks: HookSet | undefined,
  pipelineNamespace: string,
): PipelineEnvironmentHook[] {
  if (!hooks) return [];
  const toHook = (phase: 'pre' | 'post') => (b: HookBinding) => {
    const kind = b.hookRef.kind === 'ClusterHook' ? 'clusterhook' : 'hook';
    const ns =
      kind === 'clusterhook' ? CLUSTER_ENTITY_NAMESPACE : pipelineNamespace;
    return {
      key: `${phase}-${b.name}`,
      name: b.name,
      phase,
      effect: hookEffect(b, phase),
      to: `/catalog/${ns}/${kind}/${b.hookRef.name}`,
    };
  };
  return [
    ...(hooks.preDeploy ?? []).map(toHook('pre')),
    ...(hooks.postDeploy ?? []).map(toHook('post')),
  ];
}

/**
 * Hook bindings of every environment, in the shape the pipeline visualization
 * draws in its Before / After deploy lanes.
 */
export function pipelineEnvironmentHooks(
  byEnvironment: ReadonlyMap<string, HookSet>,
  namespace: string,
): Record<string, PipelineEnvironmentHook[]> {
  const result: Record<string, PipelineEnvironmentHook[]> = {};
  for (const [env, hooks] of byEnvironment) {
    const bound = hooksOfEnvironment(hooks, namespace);
    if (bound.length > 0) result[env] = bound;
  }
  return result;
}
