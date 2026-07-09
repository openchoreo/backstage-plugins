import { useCallback } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { stringifyEntityRef, type Entity } from '@backstage/catalog-model';
import {
  useOpenChoreoCache,
  useOpenChoreoQuery,
} from '@openchoreo/backstage-plugin-react';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';

/** Controller error pulled from `Component.status.conditions` (Ready=False with
 *  an error reason). Surfaces the pre-binding auto-deploy failures (bad trait,
 *  invalid config) that never produce a ReleaseBinding. */
export interface ComponentError {
  reason?: string;
  message?: string;
}

/** The component-level slice this hook reads out of `getComponentDetails`. */
interface AutoDeployState {
  autoDeploy: boolean;
  latestReleaseName: string | null;
  componentError: ComponentError | null;
}

const autoDeployKey = (entity: Entity) => [
  'auto-deploy',
  stringifyEntityRef(entity),
];

/**
 * Loads component-level state via `getComponentDetails`:
 *  - `autoDeploy` flag (toggle source of truth)
 *  - `latestReleaseName` from `status.latestRelease.name` — controller-
 *    managed pointer to the release currently bound under auto-deploy.
 *    Used by the Setup card so it doesn't fall back to picking
 *    newest-by-creation-timestamp, which picks up orphan releases.
 *  - `componentError` from `status.conditions` (Ready=False) — the only
 *    place pre-binding auto-deploy failures surface, since no ReleaseBinding
 *    (and therefore no per-env status) is ever created in that case.
 *
 * All come from the same fetch. Exposes a refetch handle so consumers
 * (Setup card toggle, post-save in WorkloadConfigPage) can re-read after
 * mutations on the server. The response is cached per entity, so revisiting
 * the tab paints the last-known toggle state instantly while a background
 * refresh runs — the entity-scoped query key replaces the old
 * `hasFetchedRef`/entity-reset bookkeeping.
 */
export const useAutoDeploy = (entity: Entity) => {
  const client = useApi(openChoreoClientApiRef);
  const cache = useOpenChoreoCache();
  const queryKey = autoDeployKey(entity);

  const { data, loading, isRefetching, refetch } =
    useOpenChoreoQuery<AutoDeployState>(queryKey, async () => {
      const componentData = await client.getComponentDetails(entity);
      return {
        autoDeploy: !!componentData?.autoDeploy,
        latestReleaseName: componentData?.latestRelease?.name ?? null,
        componentError: componentData?.hasError
          ? {
              reason: componentData.errorReason,
              message: componentData.errorMessage,
            }
          : null,
      };
    });

  // Optimistic write used by the Setup card toggle: flip the cached value
  // immediately on Confirm so the switch responds without a round-trip; the
  // PATCH runs in the background and the caller re-reads (or rolls back) via
  // refetch. Writes straight into the cache so every consumer of this entity's
  // auto-deploy state sees the flip.
  const setAutoDeployOptimistic = useCallback(
    (next: boolean) => {
      cache.setData<AutoDeployState>(queryKey, prev =>
        prev
          ? { ...prev, autoDeploy: next }
          : {
              autoDeploy: next,
              latestReleaseName: null,
              componentError: null,
            },
      );
    },
    // queryKey is derived from the entity ref; depend on its serialised form so
    // the callback identity is stable across renders for the same entity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cache, stringifyEntityRef(entity)],
  );

  return {
    autoDeploy: data?.autoDeploy ?? false,
    latestReleaseName: data?.latestReleaseName ?? null,
    componentError: data?.componentError ?? null,
    // Only the first load (no cached data) gates the setup card skeleton; later
    // refetches keep the current toggle on screen — same contract as before.
    loading,
    isRefetching,
    refetch,
    setAutoDeployOptimistic,
  };
};
