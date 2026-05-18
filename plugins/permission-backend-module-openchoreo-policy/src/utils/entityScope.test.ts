import { Entity } from '@backstage/catalog-model';
import { entityToCapabilityPath, getEntityScope } from './entityScope';

const componentEntity = (annotations: Record<string, string>): Entity => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'svc', annotations },
});

const systemEntity = (annotations: Record<string, string>): Entity => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'System',
  metadata: { name: 'pay', annotations },
});

describe('getEntityScope', () => {
  it('extracts namespace, project, and component for Components', () => {
    expect(
      getEntityScope(
        componentEntity({
          'openchoreo.io/namespace': 'acme',
          'openchoreo.io/project': 'payments',
          'openchoreo.io/component': 'api',
        }),
      ),
    ).toEqual({ namespace: 'acme', project: 'payments', component: 'api' });
  });

  it('uses PROJECT_ID annotation for System entities', () => {
    expect(
      getEntityScope(
        systemEntity({
          'openchoreo.io/namespace': 'acme',
          'openchoreo.io/project-id': 'payments',
        }),
      ),
    ).toEqual({ namespace: 'acme', project: 'payments' });
  });

  it('returns undefined for missing levels', () => {
    expect(
      getEntityScope(componentEntity({ 'openchoreo.io/namespace': 'acme' })),
    ).toEqual({ namespace: 'acme' });
  });
});

describe('entityToCapabilityPath', () => {
  it('builds full ns/project/component path', () => {
    expect(
      entityToCapabilityPath(
        componentEntity({
          'openchoreo.io/namespace': 'acme',
          'openchoreo.io/project': 'payments',
          'openchoreo.io/component': 'api',
        }),
      ),
    ).toBe('ns/acme/project/payments/component/api');
  });

  it('omits component when not present', () => {
    expect(
      entityToCapabilityPath(
        componentEntity({
          'openchoreo.io/namespace': 'acme',
          'openchoreo.io/project': 'payments',
        }),
      ),
    ).toBe('ns/acme/project/payments');
  });

  it('omits project + component when only namespace present', () => {
    expect(
      entityToCapabilityPath(
        componentEntity({ 'openchoreo.io/namespace': 'acme' }),
      ),
    ).toBe('ns/acme');
  });

  it('returns undefined when namespace annotation is missing', () => {
    expect(entityToCapabilityPath(componentEntity({}))).toBeUndefined();
  });
});
