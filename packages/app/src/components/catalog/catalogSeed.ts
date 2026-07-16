import type { QueryEntitiesResponse } from '@backstage/catalog-client';

/**
 * A cached `queryEntities` entry, reduced to just what the seed selection needs.
 * `request` is the object the CachingCatalogApi stored at `queryKey[4]`.
 */
export interface CatalogSeedEntry {
  request:
    | {
        filter?: { kind?: unknown };
        fullTextFilter?: unknown;
        offset?: number;
      }
    | undefined;
  data: QueryEntitiesResponse | undefined;
  /** TanStack's `dataUpdatedAt` — used to prefer the freshest match. */
  updatedAt: number;
}

/** The current catalog list view, as far as seed selection cares. */
export interface CatalogSeedCriteria {
  /** Lowercased selected kind, or undefined before it resolves. */
  selectedKind: string | undefined;
  /** True when any chip/search filter narrows the query. */
  hasNarrowingFilter: boolean;
  /** Pagination offset (0/undefined = first page). */
  offset: number | undefined;
  /** Whether the live list already has rows of its own to show. */
  hasLiveEntities: boolean;
}

/**
 * Whether the current view is eligible to paint from a cached seed at all.
 *
 * Only the plain first page of a kind qualifies: no chip/search filter and no
 * pagination offset. Any narrowing filter changes the query in ways we can't
 * reconstruct from the cache key alone, so seeding then could show a broader
 * page's rows (wrong scope) or stale rows for a filter that now returns nothing.
 * The seed also only matters while the live list has nothing of its own.
 */
export function isCatalogSeedEligible(criteria: CatalogSeedCriteria): boolean {
  return (
    !criteria.hasLiveEntities &&
    !criteria.hasNarrowingFilter &&
    !criteria.offset &&
    !!criteria.selectedKind
  );
}

/**
 * True when a cached entry is a safe seed for the given unfiltered, first-page
 * kind view: its request must be kind-only (exactly `{ kind }` in `filter`, no
 * extra facets), carry no `fullTextFilter`, sit at offset 0, hold data, and its
 * kind must match. This mirrors the eligibility guard on the read side so a
 * filtered/paginated cached page can never be selected.
 */
function isSeedMatch(entry: CatalogSeedEntry, selectedKind: string): boolean {
  const { request, data } = entry;
  if (data === undefined) return false;
  if (!request || request.fullTextFilter || request.offset) return false;

  const filter = (request.filter ?? {}) as Record<string, unknown>;
  const keys = Object.keys(filter);
  if (keys.length !== 1 || keys[0] !== 'kind') return false;

  const reqKind = filter.kind;
  const kinds = Array.isArray(reqKind) ? reqKind : [reqKind];
  return kinds.some(k => String(k).toLowerCase() === selectedKind);
}

/**
 * Pick the cached `queryEntities` response to seed the catalog list with, or
 * `undefined` when nothing safe is cached. Among matching kind-only first-page
 * entries, the most recently updated wins (the caller's `findAll` has no recency
 * order, so an unsorted pick could return an older/wrong page).
 *
 * Pure and side-effect-free: the caller extracts the cache entries and passes
 * the criteria; this decides which entry (if any) to paint.
 */
export function pickCatalogSeed(
  entries: CatalogSeedEntry[],
  criteria: CatalogSeedCriteria,
): QueryEntitiesResponse | undefined {
  if (!isCatalogSeedEligible(criteria)) return undefined;
  const selectedKind = criteria.selectedKind as string; // guaranteed by eligibility

  const best = entries
    .filter(entry => isSeedMatch(entry, selectedKind))
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];

  return best?.data;
}
