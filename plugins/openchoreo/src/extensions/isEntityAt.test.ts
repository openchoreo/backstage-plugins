import type { Entity } from '@backstage/catalog-model';
import { isEntityAt } from './OpenChoreoCatalogEntityPageContent';

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
