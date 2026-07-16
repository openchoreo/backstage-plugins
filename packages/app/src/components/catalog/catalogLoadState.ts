import type { Entity } from '@backstage/catalog-model';

/**
 * The catalog list's loading inputs, reduced to what the load-state derivation
 * needs.
 *
 * `useEntityList().loading` is NOT a reliable "background refetch in flight"
 * signal: the catalog reads route through `CachingCatalogApi`, which serves the
 * cached page immediately (`ensureQueryData` + `staleTime: 0`) and revalidates
 * in the background — so `loading` flips false the instant the cached value
 * resolves (~tens of ms), long before the network revalidation finishes. The
 * actual in-flight state lives on the shared `queryClient`, passed here as
 * `queryFetching` (from `useIsFetching` on the catalog `queryEntities` key).
 */
export interface CatalogLoadStateInput {
  /** `useEntityList().loading` — true only until the cached-first read resolves. */
  loading: boolean;
  /**
   * Whether the shared `queryClient` is currently fetching the catalog
   * `queryEntities` query (the real background revalidation). Drives the
   * refresh overlay so it stays up for the whole network round-trip, not just
   * the cached-read tick.
   */
  queryFetching: boolean;
  /** Live entities from `useEntityList` (may be held over during a refetch). */
  entities: Pick<Entity, 'kind'>[];
  /** Rows actually rendered: live entities, else the cached seed. */
  displayEntities: unknown[];
  /** Lowercased selected kind, or undefined before it resolves. */
  selectedKind: string | undefined;
}

export interface CatalogLoadState {
  /**
   * True when the held live entities are a different kind than the selected
   * one — a kind SWITCH, where showing the old rows under new-kind headers
   * would misalign columns, so it must be treated as a cold load.
   */
  heldKindMatches: boolean;
  /**
   * Cold load: `loading` with nothing safe to keep on screen (no rows, or a
   * kind switch). Drives the full-page skeleton/PageLoader.
   */
  firstLoad: boolean;
  /**
   * A background revalidation while rows are already on screen (held live
   * entities or the painted cache seed). Drives the quiet inline spinner so a
   * refresh is visible without wiping to the skeleton. Gated on the real
   * `queryClient` fetch state so it stays up for the whole round-trip, and
   * never true during a cold `firstLoad`.
   */
  backgroundRefreshing: boolean;
}

/**
 * Derive the catalog list's load state from `useEntityList` output, the shared
 * queryClient's fetch state, and the resolved display rows. Pure so the
 * cold-load / background-refresh split is unit-testable without standing up the
 * whole list component and its EntityListProvider context.
 */
export function deriveCatalogLoadState(
  input: CatalogLoadStateInput,
): CatalogLoadState {
  const { loading, queryFetching, entities, displayEntities, selectedKind } =
    input;

  const heldKindMatches =
    entities.length === 0 ||
    !selectedKind ||
    // A held entity with no kind can't be proven a mismatch — don't force a
    // cold reload over it (that would wipe otherwise-valid rows to the loader).
    !entities[0].kind ||
    entities[0].kind.toLowerCase() === selectedKind;

  // Cold load whenever we're loading with nothing valid to show. `displayEntities`
  // is already scoped to the SELECTED kind by the caller (matching live rows, or
  // the kind-matched cache seed — never the previous kind's held rows during a
  // switch), so an empty `displayEntities` genuinely means "nothing for this kind
  // yet". On a kind switch to a cached kind the seed fills it (no loader); to an
  // uncached kind it's empty, so the full loader shows under the new kind's title.
  const firstLoad = loading && displayEntities.length === 0;

  const backgroundRefreshing =
    queryFetching && !firstLoad && displayEntities.length > 0;

  return { heldKindMatches, firstLoad, backgroundRefreshing };
}
