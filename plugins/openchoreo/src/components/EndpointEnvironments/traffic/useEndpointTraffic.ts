import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useApi } from '@backstage/core-plugin-api';
import type { Entity } from '@backstage/catalog-model';
import type {
  EndpointTrafficEnvironment,
  EndpointTrafficInfo,
} from '@openchoreo/backstage-plugin-common';
import { effectiveBackends } from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';

export interface EndpointTrafficState {
  info: EndpointTrafficInfo | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/** Reads an Endpoint's traffic: its backends, capabilities and environments. */
export function useEndpointTraffic(entity: Entity): EndpointTrafficState {
  const client = useApi(openChoreoClientApiRef);
  const [info, setInfo] = useState<EndpointTrafficInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Only the latest read updates the state, so a slow earlier one can't
  // overwrite a newer answer.
  const latest = useRef(0);
  const refetch = useCallback(async () => {
    const read = ++latest.current;
    try {
      const next = await client.fetchEndpointTraffic(entity);
      if (read !== latest.current) return;
      setInfo(next);
      setError(null);
    } catch (e) {
      if (read === latest.current) setError(e as Error);
    } finally {
      if (read === latest.current) setLoading(false);
    }
  }, [client, entity]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { info, loading, error, refetch };
}

const EndpointTrafficContext = createContext<EndpointTrafficState>({
  info: null,
  loading: false,
  error: null,
  refetch: async () => undefined,
});

export const EndpointTrafficProvider = EndpointTrafficContext.Provider;

/** The Endpoint's traffic, as the Deploy tab read it. */
export const useEndpointTrafficContext = () =>
  useContext(EndpointTrafficContext);

/** What an environment serves: the release's backends with its own split. */
export const servedBackends = (env: EndpointTrafficEnvironment) =>
  effectiveBackends(env.release, env.overrides);
