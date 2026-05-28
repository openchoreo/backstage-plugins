import { useEffect, useState } from 'react';
import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import {
  Environment,
  useProjectEnvironments,
} from '@openchoreo/backstage-plugin-react';

// Cap each probe so a single hanging DataPlane can't block the diagram.
const NETPOL_TIMEOUT_MS = 8000;

export interface CellEnvironment extends Environment {
  /** True when the env's DataPlane reports `networkpolicyprovider=cilium`. */
  hasRuntimeObservability: boolean;
}

export interface UseCellEnvironmentsResult {
  environments: CellEnvironment[];
  loading: boolean;
}

/**
 * Layers a Cilium-provider probe on top of `useProjectEnvironments` so the
 * cell diagram can disable/warn on envs that can't support runtime obs.
 */
export const useCellEnvironments = (
  projectName: string | undefined,
  namespaceName: string | undefined,
): UseCellEnvironmentsResult => {
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const { environments: baseEnvs, loading: baseLoading } =
    useProjectEnvironments(projectName, namespaceName);
  const [environments, setEnvironments] = useState<CellEnvironment[]>([]);
  const [enriching, setEnriching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (baseLoading) return undefined;
    if (baseEnvs.length === 0) {
      setEnvironments([]);
      setEnriching(false);
      return undefined;
    }
    setEnriching(true);
    (async () => {
      try {
        const baseUrl = await discoveryApi.getBaseUrl(
          'openchoreo-observability-backend',
        );
        const enriched = await Promise.all(
          baseEnvs.map(async env => {
            if (!env.namespace || !env.dataPlaneRef?.name) {
              return { ...env, hasRuntimeObservability: false };
            }
            const controller = new AbortController();
            const timeout = setTimeout(
              () => controller.abort(),
              NETPOL_TIMEOUT_MS,
            );
            try {
              const params = new URLSearchParams({
                namespaceName: env.namespace,
                dpName: env.dataPlaneRef.name,
                dpKind: env.dataPlaneRef.kind ?? 'DataPlane',
              });
              const res = await fetchApi.fetch(
                `${baseUrl}/dataplane-netpol-provider?${params.toString()}`,
                { signal: controller.signal },
              );
              if (!res.ok) return { ...env, hasRuntimeObservability: false };
              const data = await res.json();
              return {
                ...env,
                hasRuntimeObservability:
                  data?.networkPolicyProvider === 'cilium',
              };
            } catch {
              return { ...env, hasRuntimeObservability: false };
            } finally {
              clearTimeout(timeout);
            }
          }),
        );
        if (!cancelled) setEnvironments(enriched);
      } catch {
        if (!cancelled) setEnvironments([]);
      } finally {
        if (!cancelled) setEnriching(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [baseEnvs, baseLoading, discoveryApi, fetchApi]);

  return { environments, loading: baseLoading || enriching };
};
