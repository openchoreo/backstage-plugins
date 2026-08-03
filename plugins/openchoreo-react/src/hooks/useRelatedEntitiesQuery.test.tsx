import { renderHook, waitFor } from '@testing-library/react';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { Entity, RELATION_HAS_PART } from '@backstage/catalog-model';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { useRelatedEntitiesQuery } from './useRelatedEntitiesQuery';

const namespace: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Domain',
  metadata: { name: 'acme', namespace: 'default' },
  relations: [
    { type: RELATION_HAS_PART, targetRef: 'system:default/billing' },
    { type: RELATION_HAS_PART, targetRef: 'component:default/api' },
    { type: 'ownedBy', targetRef: 'group:default/team-a' },
  ],
};

const entityFor = (ref: string): Entity => {
  const [kind, rest] = ref.split(':');
  const [ns, name] = rest.split('/');
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: kind.charAt(0).toUpperCase() + kind.slice(1),
    metadata: { name, namespace: ns },
  };
};

function makeCatalogApi(getEntitiesByRefs: jest.Mock) {
  return { getEntitiesByRefs } as any;
}

describe('useRelatedEntitiesQuery', () => {
  it('fetches only the refs matching the relation type and kind filter', async () => {
    const getEntitiesByRefs = jest.fn(async ({ entityRefs }) => ({
      items: entityRefs.map(entityFor),
    }));

    const { result } = renderHook(
      () =>
        useRelatedEntitiesQuery(namespace, {
          type: RELATION_HAS_PART,
          kind: 'System',
        }),
      {
        wrapper: createQueryWrapper([
          [catalogApiRef, makeCatalogApi(getEntitiesByRefs)],
        ]),
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    // The ownedBy relation and the non-System hasPart are both excluded.
    expect(getEntitiesByRefs).toHaveBeenCalledWith({
      entityRefs: ['system:default/billing'],
    });
    expect(result.current.entities).toEqual([
      entityFor('system:default/billing'),
    ]);
  });

  it('sorts the refs it requests, so row order is deterministic', async () => {
    // getEntitiesByRefs returns items positionally aligned to the refs given,
    // so unsorted refs would let rows follow whatever order the catalog
    // provider emitted relations in — and reshuffle between refreshes.
    const getEntitiesByRefs = jest.fn(async ({ entityRefs }) => ({
      items: entityRefs.map(entityFor),
    }));

    const reversed: Entity = {
      ...namespace,
      relations: [...(namespace.relations ?? [])].reverse(),
    };

    const { result } = renderHook(
      () => useRelatedEntitiesQuery(reversed, { type: RELATION_HAS_PART }),
      {
        wrapper: createQueryWrapper([
          [catalogApiRef, makeCatalogApi(getEntitiesByRefs)],
        ]),
      },
    );

    await waitFor(() => expect(result.current.entities).toHaveLength(2));

    // Relation order reversed on the source entity, request still sorted.
    expect(getEntitiesByRefs).toHaveBeenCalledWith({
      entityRefs: ['component:default/api', 'system:default/billing'],
    });
  });

  it('returns a stable empty array across renders when nothing matches', async () => {
    // A fresh [] per render would change the identity of the `data` prop the
    // cards pass to MUI's Table, re-rendering it (and resetting page/sort) on
    // every unrelated render.
    const { result, rerender } = renderHook(
      () => useRelatedEntitiesQuery(namespace, { kind: 'Template' }),
      {
        wrapper: createQueryWrapper([
          [catalogApiRef, makeCatalogApi(jest.fn())],
        ]),
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    const first = result.current.entities;

    rerender();

    expect(result.current.entities).toBe(first);
  });

  it('filters by relation type alone when no kind is given', async () => {
    const getEntitiesByRefs = jest.fn(async ({ entityRefs }) => ({
      items: entityRefs.map(entityFor),
    }));

    const { result } = renderHook(
      () => useRelatedEntitiesQuery(namespace, { type: RELATION_HAS_PART }),
      {
        wrapper: createQueryWrapper([
          [catalogApiRef, makeCatalogApi(getEntitiesByRefs)],
        ]),
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Refs are sorted before being sent (see the ordering test above).
    expect(getEntitiesByRefs).toHaveBeenCalledWith({
      entityRefs: ['component:default/api', 'system:default/billing'],
    });
    expect(result.current.entities).toHaveLength(2);
  });

  it('resolves to an empty list without querying when no relation matches', async () => {
    const getEntitiesByRefs = jest.fn();

    const { result } = renderHook(
      () => useRelatedEntitiesQuery(namespace, { kind: 'Template' }),
      {
        wrapper: createQueryWrapper([
          [catalogApiRef, makeCatalogApi(getEntitiesByRefs)],
        ]),
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    // No refs → the query stays disabled, and callers get a resolved empty
    // list rather than an undefined that never settles.
    expect(getEntitiesByRefs).not.toHaveBeenCalled();
    expect(result.current.entities).toEqual([]);
  });

  it('drops nulls for refs the catalog cannot resolve', async () => {
    const getEntitiesByRefs = jest.fn(async () => ({
      items: [entityFor('system:default/billing'), null],
    }));

    const { result } = renderHook(
      () => useRelatedEntitiesQuery(namespace, { type: RELATION_HAS_PART }),
      {
        wrapper: createQueryWrapper([
          [catalogApiRef, makeCatalogApi(getEntitiesByRefs)],
        ]),
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.entities).toEqual([
      entityFor('system:default/billing'),
    ]);
  });

  it('paints previous rows without a skeleton and refetches when revisited', async () => {
    // The regression this hook exists to prevent, in its real shape: navigating
    // away and back is an UNMOUNT + REMOUNT, not an in-place rerender.
    //
    // The key is the question (entity + type + kind), not the resolved refs, so
    // a project created in between lands on the same warm entry: rows paint
    // immediately with loading false, and refetchOnMount brings the new set in.
    // Were the refs in the key, this remount would hit a cold entry and the card
    // would render skeleton rows for the whole round-trip.
    const getEntitiesByRefs = jest.fn(async ({ entityRefs }) => ({
      items: entityRefs.map(entityFor),
    }));
    const wrapper = createQueryWrapper([
      [catalogApiRef, makeCatalogApi(getEntitiesByRefs)],
    ]);

    const withNewProject: Entity = {
      ...namespace,
      relations: [
        ...(namespace.relations ?? []),
        { type: RELATION_HAS_PART, targetRef: 'system:default/new-project' },
      ],
    };

    const first = renderHook(
      () => useRelatedEntitiesQuery(namespace, { type: RELATION_HAS_PART }),
      { wrapper },
    );
    await waitFor(() => expect(first.result.current.entities).toHaveLength(2));
    first.unmount();

    // Revisit, now that a project has been created.
    const second = renderHook(
      () =>
        useRelatedEntitiesQuery(withNewProject, { type: RELATION_HAS_PART }),
      { wrapper },
    );

    // Instant paint: the previous rows, never a loading state.
    expect(second.result.current.loading).toBe(false);
    expect(second.result.current.entities).toHaveLength(2);

    // ...and the refetch lands with the new relation set.
    await waitFor(() => expect(second.result.current.entities).toHaveLength(3));
    expect(second.result.current.loading).toBe(false);
    expect(getEntitiesByRefs).toHaveBeenLastCalledWith({
      entityRefs: [
        'component:default/api',
        'system:default/billing',
        'system:default/new-project',
      ],
    });
  });

  it('reuses the cache entry when re-rendered with an equal but not identical entity', async () => {
    // Backstage's useRelatedEntities keys its useAsync on the `entity` object,
    // so a new instance with identical relations refetches. Keying on the
    // resolved refs is what lets a revisit paint from cache instead.
    const getEntitiesByRefs = jest.fn(async ({ entityRefs }) => ({
      items: entityRefs.map(entityFor),
    }));
    const wrapper = createQueryWrapper([
      [catalogApiRef, makeCatalogApi(getEntitiesByRefs)],
    ]);

    const { result, rerender } = renderHook(
      ({ entity }) =>
        useRelatedEntitiesQuery(entity, { type: RELATION_HAS_PART }),
      { wrapper, initialProps: { entity: namespace } },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getEntitiesByRefs).toHaveBeenCalledTimes(1);

    // A structurally equal clone — what a re-fetched entity page hands down.
    rerender({ entity: JSON.parse(JSON.stringify(namespace)) });

    await waitFor(() => expect(result.current.entities).toHaveLength(2));
    expect(getEntitiesByRefs).toHaveBeenCalledTimes(1);
  });
});
