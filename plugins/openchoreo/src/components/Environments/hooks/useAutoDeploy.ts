import { useCallback, useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import type { Entity } from '@backstage/catalog-model';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';

/**
 * Loads the component's `autoDeploy` flag once via `getComponentDetails` and
 * exposes a refetch handle so consumers (e.g. the Setup card toggle) can
 * trigger a re-read after they update the value on the server.
 *
 * Lives at the Environments-page level so all child views (SetupDetailPane,
 * WorkloadConfigPage) read a single source of truth and don't render
 * auto-deploy-dependent UI against a stale default during initial load.
 */
export const useAutoDeploy = (entity: Entity) => {
  const client = useApi(openChoreoClientApiRef);
  const [autoDeploy, setAutoDeploy] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchOnce = useCallback(async () => {
    setLoading(true);
    try {
      const componentData = await client.getComponentDetails(entity);
      setAutoDeploy(!!componentData?.autoDeploy);
    } catch {
      // Leave at the previous value — toggle stays in its last-known state.
    } finally {
      setLoading(false);
    }
  }, [client, entity]);

  useEffect(() => {
    fetchOnce();
  }, [fetchOnce]);

  return { autoDeploy, loading, refetch: fetchOnce };
};
