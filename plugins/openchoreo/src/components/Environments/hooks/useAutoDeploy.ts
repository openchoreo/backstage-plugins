import { useCallback, useEffect, useRef, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import type { Entity } from '@backstage/catalog-model';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';

/**
 * Loads component-level state via `getComponentDetails`:
 *  - `autoDeploy` flag (toggle source of truth)
 *  - `latestReleaseName` from `status.latestRelease.name` — controller-
 *    managed pointer to the release currently bound under auto-deploy.
 *    Used by the Setup card so it doesn't fall back to picking
 *    newest-by-creation-timestamp, which picks up orphan releases.
 *
 * Both come from the same fetch. Exposes a refetch handle so consumers
 * (Setup card toggle, post-save in WorkloadConfigPage) can re-read after
 * mutations on the server.
 */
export const useAutoDeploy = (entity: Entity) => {
  const client = useApi(openChoreoClientApiRef);
  const [autoDeploy, setAutoDeploy] = useState(false);
  const [latestReleaseName, setLatestReleaseName] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  // Only the initial fetch gates the setup card's full skeleton. Later
  // refetches (manual refresh, post-save poll) keep current data on
  // screen so the entire card doesn't flash blank for a one-bit change.
  const hasFetchedRef = useRef(false);

  const fetchOnce = useCallback(async () => {
    if (!hasFetchedRef.current) setLoading(true);
    try {
      const componentData = await client.getComponentDetails(entity);
      setAutoDeploy(!!componentData?.autoDeploy);
      setLatestReleaseName(componentData?.latestRelease?.name ?? null);
    } catch {
      // Leave at the previous value — toggle stays in its last-known state.
    } finally {
      hasFetchedRef.current = true;
      setLoading(false);
    }
  }, [client, entity]);

  // If the page is reused for a different entity, force the next fetch
  // back into "initial" mode so the setup card shows a skeleton instead
  // of briefly displaying the previous entity's autoDeploy /
  // latestReleaseName while the new request is in flight. Use a stable
  // identity key (uid, falling back to name) so this doesn't re-fire
  // on every render — Backstage entities aren't referentially stable.
  const entityKey = entity.metadata?.uid ?? entity.metadata?.name;
  useEffect(() => {
    hasFetchedRef.current = false;
  }, [entityKey]);

  useEffect(() => {
    fetchOnce();
  }, [fetchOnce]);

  // Optimistic write used by the Setup card toggle: flip immediately on
  // Confirm; roll back if the PATCH fails. No fetch is triggered.
  const setAutoDeployOptimistic = useCallback((next: boolean) => {
    setAutoDeploy(next);
  }, []);

  return {
    autoDeploy,
    latestReleaseName,
    loading,
    refetch: fetchOnce,
    setAutoDeployOptimistic,
  };
};
