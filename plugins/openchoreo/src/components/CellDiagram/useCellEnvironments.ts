import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import {
  Environment,
  useOpenChoreoQuery,
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
  /** First load only — stays false during a background refresh. */
  loading: boolean;
  /** A background refresh is in flight while data is already on screen. */
  isRefetching: boolean;
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

  const { data, loading, isRefetching } = useOpenChoreoQuery<CellEnvironment[]>(
    // Key on the resolved env identities + namespace so re-enrichment happens
    // whenever the base environments change. Include each env's dataplane
    // identity (not just name) — the probe is per-dataPlaneRef, so a dataplane
    // reassignment that keeps the env name must still bust the cache.
    [
      'cell-environments',
      namespaceName ?? null,
      baseEnvs
        .map(
          env =>
            `${env.name}:${env.namespace ?? ''}:${
              env.dataPlaneRef?.name ?? ''
            }:${env.dataPlaneRef?.kind ?? ''}`,
        )
        .join(','),
    ],
    async () => {
      const baseUrl = await discoveryApi.getBaseUrl(
        'openchoreo-observability-backend',
      );
      return Promise.all(
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
            // Per-env failure degrades gracefully to `false` rather than
            // rejecting the whole query.
            if (!res.ok) return { ...env, hasRuntimeObservability: false };
            const body = await res.json();
            return {
              ...env,
              hasRuntimeObservability: body?.networkPolicyProvider === 'cilium',
            };
          } catch {
            return { ...env, hasRuntimeObservability: false };
          } finally {
            clearTimeout(timeout);
          }
        }),
      );
    },
    // Don't fetch until the base environments have resolved.
    { enabled: !baseLoading && baseEnvs.length > 0 },
  );

  return {
    environments: data ?? [],
    // First-load only: the base envs are still resolving, or the enrichment
    // query is on its first fetch with nothing cached. A background refresh
    // (isRefetching) must NOT fold in here — it would re-trigger the full
    // skeleton and blank the diagram every 30s. Surface it separately so a
    // consumer can show a subtle indicator instead.
    loading: baseLoading || loading,
    isRefetching,
  };
};
