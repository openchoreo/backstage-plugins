import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import {
  Environment,
  useOpenChoreoQuery,
  useProjectEnvironments,
  type ProjectEnvironmentsStatus,
} from '@openchoreo/backstage-plugin-react';

// Cap each probe so a single hanging DataPlane can't block the page.
const NETPOL_TIMEOUT_MS = 8000;

export interface WirelogsEnvironment extends Environment {
  /**
   * True when the env's DataPlane reports `networkpolicyprovider=cilium`.
   * Wirelogs are sourced from Hubble (Cilium), so this is the availability
   * gate for streaming wirelogs in the environment.
   */
  hasWirelogs: boolean;
}

export interface UseWirelogsEnvironmentsResult {
  environments: WirelogsEnvironment[];
  loading: boolean;
  status: ProjectEnvironmentsStatus;
  error: string | null;
  refetch: () => void;
}

/**
 * Layers a Cilium-provider probe on top of `useProjectEnvironments` so the
 * wirelogs view can disable/warn on envs whose DataPlane can't stream wirelogs.
 *
 * Mirrors `useCellEnvironments` in the openchoreo plugin — both hit the same
 * `dataplane-netpol-provider` endpoint in the observability backend. The
 * single-env `useDataPlaneNetPolProvider` hook can't be reused here because it
 * can't be called per-env inside a map.
 */
export const useWirelogsEnvironments = (
  projectName: string | undefined,
  namespaceName: string | undefined,
): UseWirelogsEnvironmentsResult => {
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const {
    environments: baseEnvs,
    loading: baseLoading,
    status: baseStatus,
    error,
    refetch,
  } = useProjectEnvironments(projectName, namespaceName);

  const {
    data,
    loading: enriching,
    error: enrichError,
  } = useOpenChoreoQuery<WirelogsEnvironment[]>(
    [
      'wirelogs-environments',
      namespaceName ?? null,
      baseEnvs.map(e => e.name).join(','),
    ],
    async () => {
      const baseUrl = await discoveryApi.getBaseUrl(
        'openchoreo-observability-backend',
      );
      return Promise.all(
        baseEnvs.map(async env => {
          if (!env.namespace || !env.dataPlaneRef?.name) {
            return { ...env, hasWirelogs: false };
          }
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), NETPOL_TIMEOUT_MS);
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
            // Per-env failure degrades to false rather than rejecting the batch.
            if (!res.ok) return { ...env, hasWirelogs: false };
            const body = await res.json();
            return {
              ...env,
              hasWirelogs: body?.networkPolicyProvider === 'cilium',
            };
          } catch {
            return { ...env, hasWirelogs: false };
          } finally {
            clearTimeout(timeout);
          }
        }),
      );
    },
    { enabled: !baseLoading && baseEnvs.length > 0 },
  );

  return {
    environments: data ?? [],
    // First-load only — a background refresh keeps the current envs on screen
    // instead of blanking to a skeleton (`isRefetching` deliberately excluded).
    loading: baseLoading || enriching,
    // A netpol-probe failure (base envs resolved, enrichment failed) is
    // surfaced as `unavailable`; otherwise mirror the base resolution status.
    status: enrichError ? 'unavailable' : baseStatus,
    error: error || (enrichError ? enrichError.message : null),
    refetch,
  };
};
