import {
  mapKindToApiKind,
  mapKindToCrdKind,
  isClusterScopedKind,
  isSupportedKind,
} from './utils';

describe('ResourceDefinition utils — ClusterResourceType wiring', () => {
  it('maps the Backstage entity kind to the API path kind', () => {
    expect(mapKindToApiKind('clusterresourcetype')).toBe('clusterresourcetypes');
    expect(mapKindToApiKind('ClusterResourceType')).toBe('clusterresourcetypes');
  });

  it('maps the Backstage entity kind to the CRD kind', () => {
    expect(mapKindToCrdKind('clusterresourcetype')).toBe('ClusterResourceType');
    expect(mapKindToCrdKind('ClusterResourceType')).toBe('ClusterResourceType');
  });

  it('marks ClusterResourceType as cluster-scoped', () => {
    expect(isClusterScopedKind('clusterresourcetype')).toBe(true);
    expect(isClusterScopedKind('ClusterResourceType')).toBe(true);
  });

  it('marks ClusterResourceType as supported', () => {
    expect(isSupportedKind('clusterresourcetype')).toBe(true);
    expect(isSupportedKind('ClusterResourceType')).toBe(true);
  });
});

describe('ResourceDefinition utils — ResourceType wiring', () => {
  it('maps the Backstage entity kind to the API path kind', () => {
    expect(mapKindToApiKind('resourcetype')).toBe('resourcetypes');
    expect(mapKindToApiKind('ResourceType')).toBe('resourcetypes');
  });

  it('maps the Backstage entity kind to the CRD kind', () => {
    expect(mapKindToCrdKind('resourcetype')).toBe('ResourceType');
    expect(mapKindToCrdKind('ResourceType')).toBe('ResourceType');
  });

  it('does not mark ResourceType as cluster-scoped', () => {
    expect(isClusterScopedKind('resourcetype')).toBe(false);
    expect(isClusterScopedKind('ResourceType')).toBe(false);
  });

  it('marks ResourceType as supported', () => {
    expect(isSupportedKind('resourcetype')).toBe(true);
    expect(isSupportedKind('ResourceType')).toBe(true);
  });
});
