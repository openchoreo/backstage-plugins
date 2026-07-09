import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { Environment } from '../components/EnvironmentFilter/types';
import { useOpenChoreoQuery } from './useOpenChoreoQuery';

/**
 * Why the project's environment list is what it is. Lets callers show a
 * cause-specific message instead of a generic "no environments found":
 * - `ok`             — one or more environments resolved.
 * - `empty-pipeline` — the pipeline loaded but defines no environments.
 * - `forbidden`      — the caller may not view the project's deployment pipeline.
 * - `unavailable`    — the deployment pipeline could not be loaded (missing,
 *                      misconfigured, or a transient failure).
 */
export type ProjectEnvironmentsStatus =
  | 'ok'
  | 'empty-pipeline'
  | 'forbidden'
  | 'unavailable';

export interface UseProjectEnvironmentsResult {
  environments: Environment[];
  loading: boolean;
  /** A background refresh is in flight while data is already on screen. */
  isRefetching: boolean;
  /** Discriminates why `environments` is empty. See {@link ProjectEnvironmentsStatus}. */
  status: ProjectEnvironmentsStatus;
  /** Raw error detail for the `unavailable` case (null otherwise). */
  error: string | null;
  /** Re-run the fetch (e.g. from a Retry button). */
  refetch: () => void;
}

/**
 * The fetcher's success shape: the resolved environments plus the status that
 * explains an empty list (`ok` vs `empty-pipeline`). The failure statuses
 * (`forbidden`/`unavailable`) are carried on a thrown
 * {@link ProjectEnvironmentsError} instead, so they never get cached as a
 * successful result.
 */
interface ProjectEnvironmentsData {
  environments: Environment[];
  status: 'ok' | 'empty-pipeline';
}

/**
 * Error thrown by the fetcher so the caller can map it back to a
 * `forbidden`/`unavailable` status. Kept out of the cache by
 * `useOpenChoreoQuery` (thrown errors land in `error`, never in `data`).
 */
class ProjectEnvironmentsError extends Error {
  constructor(
    public readonly status: 'forbidden' | 'unavailable',
    message: string,
  ) {
    super(message);
    this.name = 'ProjectEnvironmentsError';
  }
}

/**
 * Resolves the project's environments in deployment-pipeline order — source first,
 * then targets, deduped. Fans out correctly when a source has multiple targets.
 */
export const useProjectEnvironments = (
  projectName: string | undefined,
  namespaceName: string | undefined,
): UseProjectEnvironmentsResult => {
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const catalogApi = useApi(catalogApiRef);

  const enabled = Boolean(projectName && namespaceName);

  const { data, loading, isRefetching, error, refetch } =
    useOpenChoreoQuery<ProjectEnvironmentsData>(
      ['project-environments', projectName ?? '', namespaceName ?? ''],
      async (): Promise<ProjectEnvironmentsData> => {
        if (!projectName || !namespaceName) {
          return { environments: [], status: 'ok' };
        }

        const baseUrl = await discoveryApi.getBaseUrl('openchoreo');
        const params = new URLSearchParams({ projectName, namespaceName });
        const res = await fetchApi.fetch(
          `${baseUrl}/deployment-pipeline?${params.toString()}`,
        );
        if (!res.ok) {
          if (res.status === 403) {
            throw new ProjectEnvironmentsError(
              'forbidden',
              'You do not have permission to view this deployment pipeline.',
            );
          }
          throw new ProjectEnvironmentsError(
            'unavailable',
            `Failed to load deployment pipeline: ${res.status} ${res.statusText}`,
          );
        }
        const pipeline = await res.json();

        const orderedEnvNames: string[] = [];
        const seen = new Set<string>();
        const paths: Array<{
          sourceEnvironmentRef?: unknown;
          targetEnvironmentRefs?: Array<{ name?: string }>;
        }> = pipeline?.promotionPaths ?? [];
        for (const path of paths) {
          const sourceName =
            typeof path.sourceEnvironmentRef === 'string'
              ? path.sourceEnvironmentRef
              : (path.sourceEnvironmentRef as { name?: string } | undefined)
                  ?.name ?? '';
          if (sourceName && !seen.has(sourceName)) {
            orderedEnvNames.push(sourceName);
            seen.add(sourceName);
          }
          for (const target of path.targetEnvironmentRefs ?? []) {
            if (target?.name && !seen.has(target.name)) {
              orderedEnvNames.push(target.name);
              seen.add(target.name);
            }
          }
        }

        if (orderedEnvNames.length === 0) {
          return { environments: [], status: 'empty-pipeline' };
        }

        const { items } = await catalogApi.getEntities({
          filter: { kind: 'Environment', 'metadata.namespace': namespaceName },
          fields: [
            'metadata.name',
            'metadata.namespace',
            'metadata.title',
            'metadata.annotations',
          ],
        });

        const byName = new Map(items.map(e => [e.metadata.name, e]));
        const resolved: Environment[] = orderedEnvNames.map(name => {
          const entry = byName.get(name);
          const ann = entry?.metadata.annotations ?? {};
          return {
            name,
            displayName: entry?.metadata.title ?? name,
            namespace: ann[CHOREO_ANNOTATIONS.NAMESPACE] ?? namespaceName,
            dataPlaneRef: {
              name: ann['openchoreo.io/data-plane-ref'],
              kind: ann[CHOREO_ANNOTATIONS.DATA_PLANE_REF_KIND] ?? 'DataPlane',
            },
          };
        });

        return { environments: resolved, status: 'ok' };
      },
      { enabled },
    );

  // Map the query result back onto the discriminated status contract callers
  // depend on (see EnvironmentsStatusNotice). A thrown ProjectEnvironmentsError
  // carries its own status; any other error is treated as `unavailable`.
  let status: ProjectEnvironmentsStatus = 'ok';
  let errorDetail: string | null = null;
  if (error) {
    if (error instanceof ProjectEnvironmentsError) {
      status = error.status;
      // Only the `unavailable` case surfaces a raw message; forbidden is
      // rendered from its own copy in EnvironmentsStatusNotice.
      errorDetail = error.status === 'unavailable' ? error.message : null;
    } else {
      status = 'unavailable';
      errorDetail = error.message || 'Failed to load project environments';
    }
  } else if (data) {
    status = data.status;
  }

  return {
    environments: data?.environments ?? [],
    loading,
    isRefetching,
    status,
    error: errorDetail,
    refetch,
  };
};
