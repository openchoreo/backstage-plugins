import type { Entity } from '@backstage/catalog-model';
import {
  isEntityAt,
  keepUnchangedEntity,
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
