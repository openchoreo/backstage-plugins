import { useMemo } from 'react';
import { useEnvironmentHooks } from '../../DeploymentPipelineOverview/useEnvironmentHooks';
import type { Environment } from './useEnvironmentData';
import { deriveEnvironmentHooks, type EnvironmentHooks } from './hookModel';

const EMPTY: ReadonlyMap<string, EnvironmentHooks> = new Map();

/**
 * Deployment hooks (alpha) of every environment on the Deploy tab, keyed by
 * the environment's display name (`Environment.name`). Bindings come from the
 * Environment catalog entities (keyed by resource name), live status from each
 * release binding's gate. Empty while the hooks feature is off.
 */
export function useEnvironmentHookRows(
  environments: Environment[],
  catalogNamespace: string,
): ReadonlyMap<string, EnvironmentHooks> {
  const bindings = useEnvironmentHooks(catalogNamespace);

  return useMemo(() => {
    const byEnv = new Map<string, EnvironmentHooks>();
    for (const env of environments) {
      const hooks = deriveEnvironmentHooks(
        bindings.get(env.resourceName ?? env.name),
        env.deployment.gate,
      );
      if (hooks.pre.length + hooks.post.length > 0) byEnv.set(env.name, hooks);
    }
    return byEnv.size > 0 ? byEnv : EMPTY;
  }, [environments, bindings]);
}
