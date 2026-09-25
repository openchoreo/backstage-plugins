import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import {
  useHooksEnabled,
  useOpenChoreoQuery,
} from '@openchoreo/backstage-plugin-react';
import type { HookSet } from '@openchoreo/backstage-plugin-common';

const EMPTY: ReadonlyMap<string, HookSet> = new Map();

/**
 * Hook bindings (deployment hooks, alpha) of every Environment entity in a
 * catalog namespace, keyed by environment name. Bindings live on the
 * Environment, so pipeline and project views look them up here rather than on
 * the pipeline. Empty while the hooks feature is off.
 */
export function useEnvironmentHooks(
  namespace: string | undefined,
): ReadonlyMap<string, HookSet> {
  const catalogApi = useApi(catalogApiRef);
  const hooksEnabled = useHooksEnabled();
  const enabled = hooksEnabled && !!namespace;

  const { data } = useOpenChoreoQuery(
    ['environment-hooks', namespace],
    async () => {
      const { items } = await catalogApi.getEntities({
        filter: { kind: 'Environment', 'metadata.namespace': namespace! },
        fields: ['metadata.name', 'spec.hooks'],
      });
      const byName = new Map<string, HookSet>();
      for (const e of items) {
        const hooks = (e.spec as { hooks?: HookSet } | undefined)?.hooks;
        if (hooks) byName.set(e.metadata.name, hooks);
      }
      return byName as ReadonlyMap<string, HookSet>;
    },
    { enabled },
  );

  return enabled && data ? data : EMPTY;
}
