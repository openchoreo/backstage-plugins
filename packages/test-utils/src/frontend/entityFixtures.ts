import type { Entity } from '@backstage/catalog-model';

/**
 * Creates a minimal Backstage Component entity for tests.
 * Override any field via the `overrides` parameter.
 */
export function mockComponentEntity(
  overrides: {
    name?: string;
    namespace?: string;
    annotations?: Record<string, string>;
    tags?: string[];
    type?: string;
    description?: string;
  } = {},
): Entity {
  const name = overrides.name ?? 'test-component';
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name,
      namespace: overrides.namespace ?? 'default',
      description: overrides.description,
      annotations: {
        'openchoreo.io/namespace': 'test-ns',
        ...overrides.annotations,
      },
      tags: overrides.tags ?? ['service'],
    },
    spec: {
      type: overrides.type ?? 'service',
    },
  };
}

/**
 * Creates a minimal Backstage System entity (project) for tests.
 * Override any field via the `overrides` parameter.
 */
export function mockSystemEntity(
  overrides: {
    name?: string;
    namespace?: string;
    annotations?: Record<string, string>;
  } = {},
): Entity {
  const name = overrides.name ?? 'test-project';
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'System',
    metadata: {
      name,
      namespace: overrides.namespace ?? 'default',
      annotations: {
        'openchoreo.io/namespace': 'test-ns',
        ...overrides.annotations,
      },
    },
    spec: {},
  };
}
