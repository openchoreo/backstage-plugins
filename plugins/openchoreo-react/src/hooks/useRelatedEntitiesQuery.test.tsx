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

    expect(getEntitiesByRefs).toHaveBeenCalledWith({
      entityRefs: ['system:default/billing', 'component:default/api'],
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

  it('keeps the previous rows on screen while a changed relation set refetches', async () => {
    // The regression this hook exists to prevent. The refs are part of the
    // cache key, so creating a project moves the query to a fresh key — which
    // without keepPreviousData means data: undefined, loading: true, and the
    // card renders skeleton rows for the whole round-trip. That is exactly the
    // "created a project, came back, saw a skeleton" case, so the meaningful
    // assertion is that `loading` NEVER goes true and rows are never empty.
    let release: (() => void) | undefined;
    const getEntitiesByRefs = jest.fn(async ({ entityRefs }) => {
      if (entityRefs.length === 3) {
        await new Promise<void>(resolve => {
          release = resolve;
        });
      }
      return { items: entityRefs.map(entityFor) };
    });
    const wrapper = createQueryWrapper([
      [catalogApiRef, makeCatalogApi(getEntitiesByRefs)],
    ]);

    const withThirdProject: Entity = {
      ...namespace,
      relations: [
        ...(namespace.relations ?? []),
        { type: RELATION_HAS_PART, targetRef: 'system:default/new-project' },
      ],
    };

    const { result, rerender } = renderHook(
      ({ entity }) =>
        useRelatedEntitiesQuery(entity, { type: RELATION_HAS_PART }),
      { wrapper, initialProps: { entity: namespace } },
    );

    await waitFor(() => expect(result.current.entities).toHaveLength(2));

    // Relations grow by one → new cache key → fetch starts and is held open.
    rerender({ entity: withThirdProject });
    await waitFor(() => expect(getEntitiesByRefs).toHaveBeenCalledTimes(2));

    // Mid-flight: the previous two rows are still rendered, not a skeleton.
    expect(result.current.loading).toBe(false);
    expect(result.current.entities).toHaveLength(2);

    release?.();

    await waitFor(() => expect(result.current.entities).toHaveLength(3));
    expect(result.current.loading).toBe(false);
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
