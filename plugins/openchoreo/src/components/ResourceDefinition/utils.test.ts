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
