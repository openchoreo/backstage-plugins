import {
  translateClusterResourceTypeToEntity,
  translateNewClusterResourceTypeToEntity,
  translateNewResourceTypeToEntity,
  translateResourceTypeToEntity,
} from './entityTranslation';

describe('translateClusterResourceTypeToEntity', () => {
  const config = { locationKey: 'openchoreo-provider' };

  it('emits a ClusterResourceType entity with cluster-scoped metadata', () => {
    const entity = translateClusterResourceTypeToEntity(
      {
        name: 'mysql',
        displayName: 'MySQL',
        description: 'Managed MySQL template',
        retainPolicy: 'Retain',
        createdAt: '2026-05-14T10:00:00Z',
      },
      config,
    );

    expect(entity.apiVersion).toBe('backstage.io/v1alpha1');
    expect(entity.kind).toBe('ClusterResourceType');
    expect(entity.metadata.name).toBe('mysql');
    expect(entity.metadata.namespace).toBe('openchoreo-cluster');
    expect(entity.metadata.title).toBe('MySQL');
    expect(entity.metadata.description).toBe('Managed MySQL template');
    expect(entity.metadata.tags).toEqual(
      expect.arrayContaining([
        'openchoreo',
        'cluster-resource-type',
        'platform-engineering',
      ]),
    );
    expect(entity.metadata.annotations).toMatchObject({
      'backstage.io/managed-by-location': 'provider:openchoreo-provider',
      'backstage.io/managed-by-origin-location': 'provider:openchoreo-provider',
    });
    expect(entity.spec.retainPolicy).toBe('Retain');
  });

  it('defaults retainPolicy to Delete when absent', () => {
    const entity = translateClusterResourceTypeToEntity(
      { name: 'cache' },
      config,
    );
    expect(entity.spec.retainPolicy).toBe('Delete');
  });

  it('falls back to name when displayName is missing and synthesises a description', () => {
    const entity = translateClusterResourceTypeToEntity(
      { name: 'queue' },
      config,
    );
    expect(entity.metadata.title).toBe('queue');
    expect(entity.metadata.description).toBe('queue cluster resource type');
  });

  it('sets the deletion-timestamp annotation only when the input carries one', () => {
    const without = translateClusterResourceTypeToEntity(
      { name: 'a' },
      config,
    );
    expect(
      Object.keys(without.metadata.annotations ?? {}),
    ).not.toContain('openchoreo.io/deletion-timestamp');

    const withTs = translateClusterResourceTypeToEntity(
      { name: 'b', deletionTimestamp: '2026-05-14T11:00:00Z' },
      config,
    );
    expect(withTs.metadata.annotations).toMatchObject({
      'openchoreo.io/deletion-timestamp': '2026-05-14T11:00:00Z',
    });
  });
});

describe('translateNewClusterResourceTypeToEntity', () => {
  it('unwraps the typed-client shape and delegates to the inner translator', () => {
    const entity = translateNewClusterResourceTypeToEntity(
      {
        apiVersion: 'openchoreo.dev/v1alpha1',
        kind: 'ClusterResourceType',
        metadata: {
          name: 'mysql',
          annotations: {
            'openchoreo.dev/display-name': 'MySQL',
            'openchoreo.dev/description': 'Managed MySQL template',
          },
          creationTimestamp: '2026-05-14T10:00:00Z',
        } as any,
        spec: {
          retainPolicy: 'Retain',
          resources: [],
        } as any,
      } as any,
      { providerName: 'openchoreo-provider' } as any,
    );

    expect(entity.kind).toBe('ClusterResourceType');
    expect(entity.metadata.name).toBe('mysql');
    expect(entity.metadata.namespace).toBe('openchoreo-cluster');
    expect(entity.metadata.title).toBe('MySQL');
    expect(entity.spec.retainPolicy).toBe('Retain');
    expect(entity.metadata.annotations).toMatchObject({
      'backstage.io/managed-by-location': 'provider:openchoreo-provider',
    });
  });
});

describe('translateResourceTypeToEntity', () => {
  const config = { locationKey: 'openchoreo-provider' };

  it('emits a ResourceType entity scoped to its namespace with domain set', () => {
    const entity = translateResourceTypeToEntity(
      {
        name: 'mysql',
        displayName: 'MySQL',
        description: 'Managed MySQL template',
        retainPolicy: 'Retain',
        createdAt: '2026-05-14T10:00:00Z',
      },
      'analytics',
      config,
    );

    expect(entity.apiVersion).toBe('backstage.io/v1alpha1');
    expect(entity.kind).toBe('ResourceType');
    expect(entity.metadata.name).toBe('mysql');
    expect(entity.metadata.namespace).toBe('analytics');
    expect(entity.metadata.title).toBe('MySQL');
    expect(entity.metadata.description).toBe('Managed MySQL template');
    expect(entity.metadata.tags).toEqual(
      expect.arrayContaining([
        'openchoreo',
        'resource-type',
        'platform-engineering',
      ]),
    );
    expect(entity.metadata.annotations).toMatchObject({
      'backstage.io/managed-by-location': 'provider:openchoreo-provider',
      'backstage.io/managed-by-origin-location': 'provider:openchoreo-provider',
      'openchoreo.io/namespace': 'analytics',
    });
    expect(entity.spec.domain).toBe('default/analytics');
    expect(entity.spec.retainPolicy).toBe('Retain');
  });

  it('defaults retainPolicy to Delete when absent', () => {
    const entity = translateResourceTypeToEntity(
      { name: 'cache' },
      'analytics',
      config,
    );
    expect(entity.spec.retainPolicy).toBe('Delete');
  });

  it('falls back to name when displayName is missing and synthesises a description', () => {
    const entity = translateResourceTypeToEntity(
      { name: 'queue' },
      'analytics',
      config,
    );
    expect(entity.metadata.title).toBe('queue');
    expect(entity.metadata.description).toBe('queue resource type');
  });

  it('sets the deletion-timestamp annotation only when the input carries one', () => {
    const without = translateResourceTypeToEntity(
      { name: 'a' },
      'analytics',
      config,
    );
    expect(
      Object.keys(without.metadata.annotations ?? {}),
    ).not.toContain('openchoreo.io/deletion-timestamp');

    const withTs = translateResourceTypeToEntity(
      { name: 'b', deletionTimestamp: '2026-05-14T11:00:00Z' },
      'analytics',
      config,
    );
    expect(withTs.metadata.annotations).toMatchObject({
      'openchoreo.io/deletion-timestamp': '2026-05-14T11:00:00Z',
    });
  });
});

describe('translateNewResourceTypeToEntity', () => {
  it('unwraps the typed-client shape and delegates to the inner translator', () => {
    const entity = translateNewResourceTypeToEntity(
      {
        apiVersion: 'openchoreo.dev/v1alpha1',
        kind: 'ResourceType',
        metadata: {
          name: 'mysql',
          namespace: 'analytics',
          annotations: {
            'openchoreo.dev/display-name': 'MySQL',
            'openchoreo.dev/description': 'Managed MySQL template',
          },
          creationTimestamp: '2026-05-14T10:00:00Z',
        } as any,
        spec: {
          retainPolicy: 'Retain',
          resources: [],
        } as any,
      } as any,
      'analytics',
      { providerName: 'openchoreo-provider' } as any,
    );

    expect(entity.kind).toBe('ResourceType');
    expect(entity.metadata.name).toBe('mysql');
    expect(entity.metadata.namespace).toBe('analytics');
    expect(entity.metadata.title).toBe('MySQL');
    expect(entity.spec.domain).toBe('default/analytics');
    expect(entity.spec.retainPolicy).toBe('Retain');
    expect(entity.metadata.annotations).toMatchObject({
      'backstage.io/managed-by-location': 'provider:openchoreo-provider',
    });
  });
});
