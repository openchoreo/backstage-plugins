import type { CatalogLoadStateInput } from './catalogLoadState';
import { deriveCatalogLoadState } from './catalogLoadState';

const rows = (n: number) => Array.from({ length: n }, () => ({}));

// Sensible defaults; each test overrides the fields it exercises.
const base: CatalogLoadStateInput = {
  loading: false,
  queryFetching: false,
  entities: [],
  displayEntities: [],
  selectedKind: 'component',
};

describe('deriveCatalogLoadState', () => {
  describe('firstLoad (cold-load skeleton)', () => {
    it('is a cold first load when loading with nothing on screen', () => {
      const s = deriveCatalogLoadState({ ...base, loading: true });
      expect(s.firstLoad).toBe(true);
      expect(s.backgroundRefreshing).toBe(false);
    });

    it('is not a cold load once rows are on screen (seed painted)', () => {
      const s = deriveCatalogLoadState({
        ...base,
        loading: true,
        displayEntities: rows(5),
      });
      expect(s.firstLoad).toBe(false);
    });

    it('is a cold load on a switch to an UNCACHED kind (no rows to show)', () => {
      // The caller scopes `displayEntities` to the selected kind, so during a
      // switch to a kind with no cache seed it is empty (the held previous-kind
      // rows are excluded). With nothing valid to show, the full loader fires.
      const s = deriveCatalogLoadState({
        ...base,
        loading: true,
        entities: [{ kind: 'Component' }], // held previous kind, still lingering
        displayEntities: [], // but nothing shown for the new (uncached) kind
        selectedKind: 'api',
      });
      expect(s.heldKindMatches).toBe(false);
      expect(s.firstLoad).toBe(true);
    });

    it('is NOT a cold load on a switch to a CACHED kind (seed fills the rows)', () => {
      // A cached kind supplies a kind-matched seed, so the caller passes nonempty
      // `displayEntities` even though the held `entities` are the previous kind.
      // The new kind paints from the seed — no loader.
      const s = deriveCatalogLoadState({
        ...base,
        loading: true,
        entities: [{ kind: 'Component' }], // held previous kind
        displayEntities: rows(5), // the new kind's cached seed rows
        selectedKind: 'api',
      });
      expect(s.heldKindMatches).toBe(false);
      expect(s.firstLoad).toBe(false);
    });

    it('reports heldKindMatches=true for a held entity with no kind (no forced reload)', () => {
      const s = deriveCatalogLoadState({
        ...base,
        loading: true,
        // A held entity can arrive without a kind at runtime; the guard must not
        // treat that as a mismatch. Cast past the typed `kind: string`.
        entities: [{ kind: undefined as unknown as string }],
        displayEntities: rows(1),
      });
      expect(s.heldKindMatches).toBe(true);
    });

    it('is a cold load before the kind resolves (no selectedKind, no rows)', () => {
      const s = deriveCatalogLoadState({
        ...base,
        loading: true,
        selectedKind: undefined,
      });
      expect(s.firstLoad).toBe(true);
    });
  });

  describe('backgroundRefreshing (refresh overlay)', () => {
    it('is refreshing when the query is fetching behind rows on screen', () => {
      const s = deriveCatalogLoadState({
        ...base,
        queryFetching: true,
        displayEntities: rows(5),
      });
      expect(s.backgroundRefreshing).toBe(true);
    });

    it('is NOT tied to useEntityList loading — loading true, query idle → no overlay', () => {
      // The cached-first read has resolved (`loading` false soon after) but here
      // even with loading still true, if the queryClient is not fetching there
      // is no real refetch to show.
      const s = deriveCatalogLoadState({
        ...base,
        loading: true,
        queryFetching: false,
        displayEntities: rows(5),
      });
      expect(s.backgroundRefreshing).toBe(false);
    });

    it('stays on while the query fetches even after loading has settled', () => {
      // The real fix: loading already false (cached read done), but the network
      // revalidation is still in flight — the overlay must remain.
      const s = deriveCatalogLoadState({
        ...base,
        loading: false,
        queryFetching: true,
        entities: [{ kind: 'Component' }],
        displayEntities: rows(3),
      });
      expect(s.firstLoad).toBe(false);
      expect(s.backgroundRefreshing).toBe(true);
    });

    it('does not show the overlay during a cold load (no rows yet)', () => {
      // firstLoad owns the screen; even if the query is fetching, there are no
      // rows to overlay, so it's the PageLoader, not the refresh spinner.
      const s = deriveCatalogLoadState({
        ...base,
        loading: true,
        queryFetching: true,
        displayEntities: [],
      });
      expect(s.firstLoad).toBe(true);
      expect(s.backgroundRefreshing).toBe(false);
    });

    it('shows neither indicator once the fetch has settled', () => {
      const s = deriveCatalogLoadState({
        ...base,
        entities: [{ kind: 'Component' }],
        displayEntities: rows(3),
      });
      expect(s.firstLoad).toBe(false);
      expect(s.backgroundRefreshing).toBe(false);
    });
  });
});
