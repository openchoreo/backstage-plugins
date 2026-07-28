import type { QueryEntitiesResponse } from '@backstage/catalog-client';
import {
  isCatalogSeedEligible,
  pickCatalogSeed,
  type CatalogSeedEntry,
  type CatalogSeedCriteria,
} from './catalogSeed';

const resp = (n: number): QueryEntitiesResponse => ({
  items: Array.from({ length: n }, (_, i) => ({
    apiVersion: 'v1',
    kind: 'Component',
    metadata: { name: `c${i}` },
  })) as QueryEntitiesResponse['items'],
  totalItems: n,
  pageInfo: {},
});

/** A kind-only, first-page cached entry (the shape the seed accepts). */
const firstPageEntry = (
  kind: string,
  n: number,
  updatedAt = 1,
): CatalogSeedEntry => ({
  request: { filter: { kind }, offset: 0 },
  data: resp(n),
  updatedAt,
});

const eligible: CatalogSeedCriteria = {
  selectedKind: 'component',
  hasNarrowingFilter: false,
  offset: 0,
  hasLiveEntities: false,
};

describe('isCatalogSeedEligible', () => {
  it('is eligible on the unfiltered first page with no live rows', () => {
    expect(isCatalogSeedEligible(eligible)).toBe(true);
  });

  it('is not eligible once the live list has rows', () => {
    expect(isCatalogSeedEligible({ ...eligible, hasLiveEntities: true })).toBe(
      false,
    );
  });

  it('is not eligible when a narrowing filter is active', () => {
    expect(
      isCatalogSeedEligible({ ...eligible, hasNarrowingFilter: true }),
    ).toBe(false);
  });

  it('is not eligible on a paginated view (offset > 0)', () => {
    expect(isCatalogSeedEligible({ ...eligible, offset: 25 })).toBe(false);
  });

  it('is not eligible before the kind resolves', () => {
    expect(
      isCatalogSeedEligible({ ...eligible, selectedKind: undefined }),
    ).toBe(false);
  });
});

describe('pickCatalogSeed', () => {
  it('returns undefined when the view is not eligible', () => {
    expect(
      pickCatalogSeed([firstPageEntry('component', 5)], {
        ...eligible,
        hasNarrowingFilter: true,
      }),
    ).toBeUndefined();
  });

  it('returns undefined on an empty cache (cold miss)', () => {
    expect(pickCatalogSeed([], eligible)).toBeUndefined();
  });

  it('seeds the matching kind-only first page', () => {
    const seed = pickCatalogSeed([firstPageEntry('component', 5)], eligible);
    expect(seed?.totalItems).toBe(5);
  });

  it('ignores a cached page for a different kind', () => {
    expect(
      pickCatalogSeed([firstPageEntry('api', 9)], eligible),
    ).toBeUndefined();
  });

  it('rejects a page that carried extra filter facets (e.g. a project filter)', () => {
    const filtered: CatalogSeedEntry = {
      request: {
        filter: {
          kind: 'component',
          'metadata.annotations.openchoreo.io/project': 'foo',
        } as Record<string, unknown>,
        offset: 0,
      },
      data: resp(2),
      updatedAt: 1,
    };
    expect(pickCatalogSeed([filtered], eligible)).toBeUndefined();
  });

  it('rejects a page that had a fullTextFilter (search active)', () => {
    const searched: CatalogSeedEntry = {
      request: { filter: { kind: 'component' }, fullTextFilter: { term: 'x' } },
      data: resp(1),
      updatedAt: 1,
    };
    expect(pickCatalogSeed([searched], eligible)).toBeUndefined();
  });

  it('rejects a non-first-page (offset > 0) cached entry', () => {
    const page2: CatalogSeedEntry = {
      request: { filter: { kind: 'component' }, offset: 25 },
      data: resp(5),
      updatedAt: 1,
    };
    expect(pickCatalogSeed([page2], eligible)).toBeUndefined();
  });

  it('skips entries whose data is still undefined (fetch in flight)', () => {
    const pending: CatalogSeedEntry = {
      request: { filter: { kind: 'component' }, offset: 0 },
      data: undefined,
      updatedAt: 5,
    };
    expect(
      pickCatalogSeed([pending, firstPageEntry('component', 3, 1)], eligible)
        ?.totalItems,
    ).toBe(3);
  });

  it('prefers the most recently updated match (not insertion order)', () => {
    const older = firstPageEntry('component', 2, 100);
    const newer = firstPageEntry('component', 7, 200);
    // Pass older first to prove selection is by recency, not array order.
    expect(pickCatalogSeed([older, newer], eligible)?.totalItems).toBe(7);
  });

  it('matches a kind supplied as a single-element array', () => {
    const arrayKind: CatalogSeedEntry = {
      request: { filter: { kind: ['Component'] }, offset: 0 },
      data: resp(4),
      updatedAt: 1,
    };
    expect(pickCatalogSeed([arrayKind], eligible)?.totalItems).toBe(4);
  });

  it('treats offset 0 and absent offset as first page', () => {
    const noOffset: CatalogSeedEntry = {
      request: { filter: { kind: 'component' } },
      data: resp(6),
      updatedAt: 1,
    };
    expect(pickCatalogSeed([noOffset], eligible)?.totalItems).toBe(6);
  });
});
