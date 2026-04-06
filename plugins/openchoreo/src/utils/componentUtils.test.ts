import { Entity } from '@backstage/catalog-model';
import { isFromSourceComponent } from './componentUtils';

describe('isFromSourceComponent', () => {
  it('returns true when entity has workflow in spec', () => {
    const entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: { name: 'test' },
      spec: { workflow: 'build-and-deploy' },
    } as unknown as Entity;

    expect(isFromSourceComponent(entity)).toBe(true);
  });

  it('returns false when entity has no workflow in spec', () => {
    const entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: { name: 'test' },
      spec: { type: 'service' },
    } as unknown as Entity;

    expect(isFromSourceComponent(entity)).toBe(false);
  });

  it('returns false when spec is undefined', () => {
    const entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: { name: 'test' },
    } as unknown as Entity;

    expect(isFromSourceComponent(entity)).toBe(false);
  });
});
