import {
  mapKindToApiKind,
  mapKindToCrdKind,
  isClusterScopedKind,
  isSupportedKind,
} from './utils';

describe('ResourceDefinition utils — ClusterResourceType wiring', () => {
  it('maps the Backstage entity kind to the API path kind', () => {
    expect(mapKindToApiKind('clusterresourcetype')).toBe(
      'clusterresourcetypes',
    );
    expect(mapKindToApiKind('ClusterResourceType')).toBe(
      'clusterresourcetypes',
    );
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

describe('ResourceDefinition utils — ProjectType wiring', () => {
  it('maps the Backstage entity kind to the API path kind', () => {
    expect(mapKindToApiKind('projecttype')).toBe('projecttypes');
    expect(mapKindToApiKind('ProjectType')).toBe('projecttypes');
  });

  it('maps the Backstage entity kind to the CRD kind', () => {
    expect(mapKindToCrdKind('projecttype')).toBe('ProjectType');
    expect(mapKindToCrdKind('ProjectType')).toBe('ProjectType');
  });

  it('does not mark ProjectType as cluster-scoped', () => {
    expect(isClusterScopedKind('projecttype')).toBe(false);
    expect(isClusterScopedKind('ProjectType')).toBe(false);
  });

  it('marks ProjectType as supported', () => {
    expect(isSupportedKind('projecttype')).toBe(true);
    expect(isSupportedKind('ProjectType')).toBe(true);
  });
});

describe('ResourceDefinition utils — ClusterProjectType wiring', () => {
  it('maps the Backstage entity kind to the API path kind', () => {
    expect(mapKindToApiKind('clusterprojecttype')).toBe('clusterprojecttypes');
    expect(mapKindToApiKind('ClusterProjectType')).toBe('clusterprojecttypes');
  });

  it('maps the Backstage entity kind to the CRD kind', () => {
    expect(mapKindToCrdKind('clusterprojecttype')).toBe('ClusterProjectType');
    expect(mapKindToCrdKind('ClusterProjectType')).toBe('ClusterProjectType');
  });

  it('marks ClusterProjectType as cluster-scoped', () => {
    expect(isClusterScopedKind('clusterprojecttype')).toBe(true);
    expect(isClusterScopedKind('ClusterProjectType')).toBe(true);
  });

  it('marks ClusterProjectType as supported', () => {
    expect(isSupportedKind('clusterprojecttype')).toBe(true);
    expect(isSupportedKind('ClusterProjectType')).toBe(true);
  });
});

describe('ResourceDefinition utils — ObservabilityAlertsNotificationChannel wiring', () => {
  it('maps the Backstage entity kind to the API path kind', () => {
    expect(mapKindToApiKind('observabilityalertsnotificationchannel')).toBe(
      'observabilityalertsnotificationchannels',
    );
    expect(mapKindToApiKind('ObservabilityAlertsNotificationChannel')).toBe(
      'observabilityalertsnotificationchannels',
    );
  });

  it('maps the Backstage entity kind to the CRD kind', () => {
    expect(mapKindToCrdKind('observabilityalertsnotificationchannel')).toBe(
      'ObservabilityAlertsNotificationChannel',
    );
    expect(mapKindToCrdKind('ObservabilityAlertsNotificationChannel')).toBe(
      'ObservabilityAlertsNotificationChannel',
    );
  });

  it('does not mark ObservabilityAlertsNotificationChannel as cluster-scoped', () => {
    expect(isClusterScopedKind('observabilityalertsnotificationchannel')).toBe(
      false,
    );
    expect(isClusterScopedKind('ObservabilityAlertsNotificationChannel')).toBe(
      false,
    );
  });

  it('marks ObservabilityAlertsNotificationChannel as supported', () => {
    expect(isSupportedKind('observabilityalertsnotificationchannel')).toBe(
      true,
    );
    expect(isSupportedKind('ObservabilityAlertsNotificationChannel')).toBe(
      true,
    );
  });
});
