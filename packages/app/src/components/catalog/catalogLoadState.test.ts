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

    it('treats a kind switch as a cold load (held rows are a different kind)', () => {
      // Production state: `useEntityList` keeps the old Component `entities`
      // while the new kind refetches, and CatalogCardList renders those held
      // rows as `displayEntities` (entities take precedence over the seed). So
      // the fixture must carry NONEMPTY held display rows — the kind mismatch
      // has to force a cold load anyway, or they'd render under API headers.
      const heldComponentRows = [{ kind: 'Component' }];
      const s = deriveCatalogLoadState({
        ...base,
        loading: true,
        entities: heldComponentRows,
        displayEntities: heldComponentRows,
        selectedKind: 'api',
      });
      expect(s.heldKindMatches).toBe(false);
      expect(s.firstLoad).toBe(true);
    });

    it('does not force a cold reload over a held entity that has no kind', () => {
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
