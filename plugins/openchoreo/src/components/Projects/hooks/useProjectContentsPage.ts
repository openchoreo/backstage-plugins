import { useMemo } from 'react';
import { Entity } from '@backstage/catalog-model';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { useApi } from '@backstage/core-plugin-api';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';

/** Per-environment deployment status, shared by Components and Resources. */
export interface EnvironmentDeploymentStatus {
  isDeployed: boolean;
  /** Status from the (Resource)ReleaseBinding: Ready, NotReady, Failed, etc. */
  status?: string;
  statusReason?: string;
  statusMessage?: string;
}

/** Deployment status keyed by lowercased environment name. */
export type DeploymentStatusByEnv = Record<string, EnvironmentDeploymentStatus>;

/** Entity kinds surfaced in the project's "Project Contents" table. */
export type ProjectContentKind = 'component' | 'resource';

/** A single row in the unified Project Contents table. */
export interface ProjectContentItem {
  entity: Entity;
  kind: ProjectContentKind;
  name: string;
  displayName: string;
  type: string;
  description: string;
  deploymentStatus: DeploymentStatusByEnv;
  /**
   * False until this row's release bindings have been fetched. Rows render from
   * catalog data first; the Deployment column shows a skeleton until this flips.
   */
  deploymentLoaded: boolean;
  createdAt?: string;
}

/** The catalog field a column maps to for server-side ordering. */
export type ProjectContentsOrderBy = 'name' | 'createdAt';

export interface ProjectContentsPageParams {
  systemEntity: Entity;
  /** Free-text search term (already debounced by the caller). */
  search: string;
  /** Selected kinds (lowercased, e.g. "component"); `null` means "all kinds". */
  kinds: Set<string> | null;
  /** Selected `spec.type` values; `null` means "all types". */
  types: Set<string> | null;
  orderBy: ProjectContentsOrderBy;
  orderDir: 'asc' | 'desc';
  /** Cursor for the page to fetch; omit/undefined for the first page. */
  cursor?: string;
  limit: number;
  /**
   * Opaque value that re-runs the fetch when it changes. Bump it to refresh the
   * current page in place (e.g. after a component is marked for deletion).
   */
  refreshToken?: number;
}

export interface ProjectContentsPageResult {
  items: ProjectContentItem[];
  totalItems: number;
  prevCursor?: string;
  nextCursor?: string;
  /** First load with no page on screen yet. */
  loading: boolean;
  /** A fetch is in flight while a page is already on screen (paging/refresh). */
  isRefetching: boolean;
  error: Error | null;
  /** Re-run both the page query and its deployment-status enrichment. */
  refetch: () => Promise<void>;
}

/** The page-query payload: catalog rows plus paging cursors. */
interface ProjectContentsPageData {
  items: ProjectContentItem[];
  totalItems: number;
  prevCursor?: string;
  nextCursor?: string;
}

type BindingLike = {
  environment?: string;
  status?: string;
  statusReason?: string;
  statusMessage?: string;
};

function toDeploymentStatus(bindings?: BindingLike[]): DeploymentStatusByEnv {
  const status: DeploymentStatusByEnv = {};
  for (const binding of bindings ?? []) {
    const env = binding.environment?.toLowerCase();
    if (env) {
      status[env] = {
        isDeployed: true,
        status: binding.status,
        statusReason: binding.statusReason,
        statusMessage: binding.statusMessage,
      };
    }
  }
  return status;
}

const ALL_KINDS = ['Component', 'Resource'];

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function buildFilter(
  project: string,
  namespace: string,
  kinds: Set<string> | null,
  types: Set<string> | null,
) {
  const filter: Record<string, string | string[]> = {
    kind: kinds && kinds.size > 0 ? [...kinds].map(capitalize) : ALL_KINDS,
    'spec.system': project,
    'metadata.namespace': namespace,
  };
  if (types && types.size > 0) {
    filter['spec.type'] = [...types];
  }
  return filter;
}

function buildOrderFields(
  orderBy: ProjectContentsOrderBy,
  orderDir: 'asc' | 'desc',
) {
  // IMPORTANT: keep this to a SINGLE order field. The catalog only takes its
  // cursor-safe "fast path" when `order.length <= 1`; adding a tiebreak field
  // forces a multi-join path that paginates incorrectly with cursors. The
  // backend already appends a stable entity-id tiebreak on the fast path.
  //
  // Name sorts by `metadata.title` (not `metadata.name`) because that is the
  // value rendered in the column (the catalog provider always sets
  // title = displayName || name), so the visible order stays alphabetical.
  // created-at is ISO-8601, so the index's lexical order is chronological.
  const field =
    orderBy === 'createdAt'
      ? `metadata.annotations.${CHOREO_ANNOTATIONS.CREATED_AT}`
      : 'metadata.title';
  return [{ field, order: orderDir }];
}

function toBaseItem(entity: Entity): ProjectContentItem {
  const kindValue: ProjectContentKind =
    entity.kind.toLowerCase() === 'resource' ? 'resource' : 'component';
  return {
    entity,
    kind: kindValue,
    name: entity.metadata.name,
    displayName: entity.metadata.title || entity.metadata.name,
    type: String((entity.spec as { type?: unknown })?.type ?? ''),
    description: entity.metadata.description ?? '',
    deploymentStatus: {},
    deploymentLoaded: false,
    createdAt:
      entity.metadata.annotations?.[CHOREO_ANNOTATIONS.CREATED_AT] || undefined,
  };
}

/** Stable per-row identity, so the status merge is never index-based. */
function rowKey(item: ProjectContentItem): string {
  const ns = item.entity.metadata.namespace ?? 'default';
  return `${item.kind}:${ns}/${item.name}`;
}

/**
 * Fetches a single, server-paginated page of the project's Components and
 * Resources from the catalog (filtering, full-text search and ordering all run
 * server-side), then enriches only that page's rows with deployment status.
 *
 * Built on two dependent React Query hooks:
 *  1. the page query — returns the catalog rows fast so the table paints; keyed
 *     on every filter/sort/cursor input plus `keepPreviousData` so paging swaps
 *     content without flashing a skeleton.
 *  2. the bindings query — enabled once the page resolves, it fetches release
 *     bindings for exactly the visible rows and is keyed on those rows, so it
 *     re-runs when the page changes. Its result is a status map merged back by
 *     row identity (never by index), which keeps the merge correct even while
 *     the previous page is still on screen.
 *
 * Changing any filter/search/sort should reset the caller's `cursor` to
 * `undefined` so the next fetch starts from the first page.
 */
export function useProjectContentsPage(
  params: ProjectContentsPageParams,
): ProjectContentsPageResult {
  const catalogApi = useApi(catalogApiRef);
  const client = useApi(openChoreoClientApiRef);

  const {
    systemEntity,
    search,
    kinds,
    types,
    orderBy,
    orderDir,
    cursor,
    limit,
    refreshToken,
  } = params;
  const project = systemEntity.metadata.name;
  const namespace =
    systemEntity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];
  // Stable primitive dependencies for the Set inputs.
  const kindsKey = kinds ? [...kinds].sort().join(' ') : '*';
  const typesKey = types ? [...types].sort().join(' ') : '*';

  // No project context, or the user has explicitly cleared every kind/type.
  const clearedAllFilters =
    (kinds !== null && kinds.size === 0) ||
    (types !== null && types.size === 0);
  const canFetchPage = !!project && !!namespace && !clearedAllFilters;

  // --- Page query: the catalog rows (renders the table fast) --------------
  const pageQuery = useOpenChoreoQuery<ProjectContentsPageData>(
    [
      'project-contents-page',
      namespace,
      project,
      search,
      kindsKey,
      typesKey,
      orderBy,
      orderDir,
      cursor ?? 'first',
      limit,
      refreshToken ?? 0,
    ],
    async () => {
      // A cursor request carries the original filter/order in the cursor, so we
      // must not re-send them; a first-page request builds them fresh.
      const response = cursor
        ? await catalogApi.queryEntities({ cursor, limit })
        : await catalogApi.queryEntities({
            limit,
            filter: buildFilter(project, namespace!, kinds, types),
            orderFields: buildOrderFields(orderBy, orderDir),
            fullTextFilter: search
              ? {
                  // Search by name only (displayed title + entity name).
                  term: search,
                  fields: ['metadata.title', 'metadata.name'],
                }
              : undefined,
          });
      return {
        items: response.items.map(toBaseItem),
        totalItems: response.totalItems,
        prevCursor: response.pageInfo.prevCursor,
        nextCursor: response.pageInfo.nextCursor,
      };
    },
    { enabled: canFetchPage, keepPreviousData: true },
  );

  const baseItems = useMemo(
    () => pageQuery.data?.items ?? [],
    [pageQuery.data],
  );

  // --- Bindings query: deployment status for exactly the visible rows -----
  // Keyed on the rows on screen so it refetches when the page changes.
  const rowsKey = baseItems.map(rowKey).join('|');
  const bindingsQuery = useOpenChoreoQuery<
    Record<string, DeploymentStatusByEnv>
  >(
    ['project-contents-bindings', namespace, project, rowsKey],
    async () => {
      const entries = await Promise.all(
        baseItems.map(async item => {
          try {
            const response =
              item.kind === 'component'
                ? await client.fetchReleaseBindings(item.entity)
                : await client.fetchResourceReleaseBindings(item.entity);
            return [
              rowKey(item),
              toDeploymentStatus(response?.data?.items),
            ] as const;
          } catch {
            // Leave deployment status empty if bindings can't be fetched.
            return [rowKey(item), {}] as const;
          }
        }),
      );
      return Object.fromEntries(entries);
    },
    { enabled: baseItems.length > 0 },
  );

  // Merge base rows with their deployment status by row identity. Until the
  // status map for THIS page is available, rows stay `deploymentLoaded: false`
  // so the Deployment column skeletons.
  const items = useMemo<ProjectContentItem[]>(() => {
    const statuses = bindingsQuery.data;
    return baseItems.map(item => ({
      ...item,
      deploymentStatus: statuses?.[rowKey(item)] ?? {},
      deploymentLoaded: statuses !== undefined,
    }));
  }, [baseItems, bindingsQuery.data]);

  const refetch = async () => {
    await Promise.all([pageQuery.refetch(), bindingsQuery.refetch()]);
  };

  return {
    items,
    totalItems: pageQuery.data?.totalItems ?? 0,
    prevCursor: pageQuery.data?.prevCursor,
    nextCursor: pageQuery.data?.nextCursor,
    loading: pageQuery.loading,
    isRefetching: pageQuery.isRefetching,
    error: pageQuery.error,
    refetch,
  };
}
