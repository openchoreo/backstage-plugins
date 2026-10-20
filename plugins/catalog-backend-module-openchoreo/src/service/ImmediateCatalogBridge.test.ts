import { Entity } from '@backstage/catalog-model';
import { ServiceFactoryTester } from '@backstage/backend-test-utils';
import {
  ImmediateCatalogBridge,
  immediateCatalogBridgeRef,
} from './ImmediateCatalogBridge';
import { immediateCatalogServiceFactory } from '../module';

const entity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Environment',
  metadata: { name: 'staging', namespace: 'test-ns' },
  spec: {},
};

function mockTarget() {
  return {
    insertEntity: jest.fn().mockResolvedValue(undefined),
    removeEntity: jest.fn().mockResolvedValue(undefined),
  };
}

describe('ImmediateCatalogBridge', () => {
  it('fails clearly before the catalog module attaches a provider', async () => {
    const bridge = new ImmediateCatalogBridge();

    await expect(bridge.insertEntity(entity)).rejects.toThrow(
      'OpenChoreo catalog module has not started',
    );
    await expect(
      bridge.removeEntity('environment:test-ns/staging'),
    ).rejects.toThrow('OpenChoreo catalog module has not started');
  });

  it('forwards writes to the attached provider', async () => {
    const bridge = new ImmediateCatalogBridge();
    const target = mockTarget();
    bridge.attach(target);

    await bridge.insertEntity(entity);
    await bridge.removeEntity('environment:test-ns/staging');

    expect(target.insertEntity).toHaveBeenCalledWith(entity);
    expect(target.removeEntity).toHaveBeenCalledWith(
      'environment:test-ns/staging',
    );
  });
});

describe('immediateCatalogServiceFactory', () => {
  it('gives every plugin a service backed by the one shared bridge', async () => {
    const tester = ServiceFactoryTester.from(immediateCatalogServiceFactory);
    const bridge = await tester.getService(immediateCatalogBridgeRef);
    const target = mockTarget();
    bridge.attach(target);

    const scaffolderService = await tester.getSubject('scaffolder');
    const otherService = await tester.getSubject('openchoreo');
    await scaffolderService.insertEntity(entity);
    await otherService.removeEntity('environment:test-ns/staging');

    expect(target.insertEntity).toHaveBeenCalledWith(entity);
    expect(target.removeEntity).toHaveBeenCalledWith(
      'environment:test-ns/staging',
    );
  });
});
