import type { Entity } from '@backstage/catalog-model';
import {
  isEntityAt,
  keepUnchangedEntity,
  resolveEntityLoad,
} from './OpenChoreoCatalogEntityPageContent';

const entity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Endpoint',
  metadata: { name: 'orders-api', namespace: 'acme' },
};

describe('isEntityAt', () => {
  it("matches the route's entity, ignoring case", () => {
    expect(
      isEntityAt(entity, {
        kind: 'endpoint',
        namespace: 'acme',
        name: 'Orders-API',
      }),
    ).toBe(true);
  });

  it('rejects another entity or none', () => {
    const route = { kind: 'endpoint', namespace: 'acme', name: 'orders-api' };
    expect(isEntityAt(undefined, route)).toBe(false);
    expect(isEntityAt(entity, { ...route, name: 'payments-api' })).toBe(false);
    expect(isEntityAt(entity, { ...route, namespace: 'default' })).toBe(false);
    expect(isEntityAt(entity, { ...route, kind: 'component' })).toBe(false);
  });

  it('reads a missing namespace as default', () => {
    expect(
      isEntityAt(
        { ...entity, metadata: { name: 'orders-api' } },
        { kind: 'endpoint', namespace: 'default', name: 'orders-api' },
      ),
    ).toBe(true);
  });
});

describe('keepUnchangedEntity', () => {
  const v1: Entity = {
    ...entity,
    metadata: { ...entity.metadata, uid: 'u1', etag: 'e1' },
  };

  it('keeps the previous object when the etag is unchanged', () => {
    const refreshed = { ...v1, metadata: { ...v1.metadata } };
    expect(keepUnchangedEntity(v1, refreshed)).toBe(v1);
  });

  it('takes the new object when the entity changed', () => {
    const changed = { ...v1, metadata: { ...v1.metadata, etag: 'e2' } };
    expect(keepUnchangedEntity(v1, changed)).toBe(changed);
  });

  it('takes the new object for another entity', () => {
    const other = { ...v1, metadata: { ...v1.metadata, uid: 'u2' } };
    expect(keepUnchangedEntity(v1, other)).toBe(other);
  });

  it('compares the content when there is no etag', () => {
    const same = JSON.parse(JSON.stringify(entity));
    expect(keepUnchangedEntity(entity, same)).toBe(entity);
    const changed = { ...entity, spec: { backends: [] } };
    expect(keepUnchangedEntity(entity, changed)).toBe(changed);
  });

  it('passes through a first load or a missing entity', () => {
    expect(keepUnchangedEntity(undefined, v1)).toBe(v1);
    expect(keepUnchangedEntity(v1, undefined)).toBeUndefined();
  });
});

describe('resolveEntityLoad', () => {
  const route = { kind: 'endpoint', namespace: 'acme', name: 'orders-api' };
  const failure = new Error('catalog unavailable');

  it('keeps the entity on screen when its refresh fails', () => {
    expect(
      resolveEntityLoad(
        entity,
        { entity: undefined, loading: false, error: failure },
        route,
      ),
    ).toEqual({ entity, loading: false });
  });

  it('reports a failed first load', () => {
    expect(
      resolveEntityLoad(
        undefined,
        { entity: undefined, loading: false, error: failure },
        route,
      ),
    ).toEqual({ entity: undefined, loading: false, error: failure });
  });

  it('reports a failed load of another entity', () => {
    const other = { ...route, name: 'payments-api' };
    expect(
      resolveEntityLoad(
        entity,
        { entity: undefined, loading: false, error: failure },
        other,
      ).error,
    ).toBe(failure);
  });

  it('reports no loading while refreshing the entity on screen', () => {
    expect(
      resolveEntityLoad(entity, { entity, loading: true }, route).loading,
    ).toBe(false);
    expect(
      resolveEntityLoad(undefined, { entity: undefined, loading: true }, route)
        .loading,
    ).toBe(true);
  });

  it('passes a deleted entity through as missing', () => {
    expect(
      resolveEntityLoad(entity, { entity: undefined, loading: false }, route)
        .entity,
    ).toBeUndefined();
  });
});
