import {
  openchoreoProjectTypeCreatePermission,
  openchoreoProjectTypeUpdatePermission,
  openchoreoProjectTypeDeletePermission,
  openchoreoClusterProjectTypeCreatePermission,
  openchoreoClusterProjectTypeUpdatePermission,
  openchoreoClusterProjectTypeDeletePermission,
  openchoreoNotificationChannelCreatePermission,
  openchoreoNotificationChannelReadPermission,
  openchoreoNotificationChannelUpdatePermission,
  openchoreoNotificationChannelDeletePermission,
  openchoreoPermissions,
  OPENCHOREO_PERMISSION_TO_ACTION,
  OPENCHOREO_MANAGED_ENTITY_KINDS,
  CATALOG_KIND_TO_ACTION,
} from './permissions';

describe('ProjectType / ClusterProjectType permissions', () => {
  it('defines namespaced project-type permissions with the expected names and actions', () => {
    expect(openchoreoProjectTypeCreatePermission.name).toBe(
      'openchoreo.projecttype.create',
    );
    expect(openchoreoProjectTypeCreatePermission.attributes.action).toBe(
      'create',
    );
    expect(openchoreoProjectTypeUpdatePermission.name).toBe(
      'openchoreo.projecttype.update',
    );
    expect(openchoreoProjectTypeUpdatePermission.attributes.action).toBe(
      'update',
    );
    expect(openchoreoProjectTypeDeletePermission.name).toBe(
      'openchoreo.projecttype.delete',
    );
    expect(openchoreoProjectTypeDeletePermission.attributes.action).toBe(
      'delete',
    );
  });

  it('defines cluster project-type permissions with the expected names and actions', () => {
    expect(openchoreoClusterProjectTypeCreatePermission.name).toBe(
      'openchoreo.clusterprojecttype.create',
    );
    expect(openchoreoClusterProjectTypeUpdatePermission.name).toBe(
      'openchoreo.clusterprojecttype.update',
    );
    expect(openchoreoClusterProjectTypeDeletePermission.name).toBe(
      'openchoreo.clusterprojecttype.delete',
    );
  });

  it('registers all six project-type permissions in openchoreoPermissions', () => {
    const names = openchoreoPermissions.map(p => p.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'openchoreo.projecttype.create',
        'openchoreo.projecttype.update',
        'openchoreo.projecttype.delete',
        'openchoreo.clusterprojecttype.create',
        'openchoreo.clusterprojecttype.update',
        'openchoreo.clusterprojecttype.delete',
      ]),
    );
  });

  it('maps project-type permissions to their authz actions', () => {
    expect(
      OPENCHOREO_PERMISSION_TO_ACTION['openchoreo.projecttype.create'],
    ).toBe('projecttype:create');
    expect(
      OPENCHOREO_PERMISSION_TO_ACTION['openchoreo.projecttype.update'],
    ).toBe('projecttype:update');
    expect(
      OPENCHOREO_PERMISSION_TO_ACTION['openchoreo.projecttype.delete'],
    ).toBe('projecttype:delete');
    expect(
      OPENCHOREO_PERMISSION_TO_ACTION['openchoreo.clusterprojecttype.create'],
    ).toBe('clusterprojecttype:create');
    expect(
      OPENCHOREO_PERMISSION_TO_ACTION['openchoreo.clusterprojecttype.update'],
    ).toBe('clusterprojecttype:update');
    expect(
      OPENCHOREO_PERMISSION_TO_ACTION['openchoreo.clusterprojecttype.delete'],
    ).toBe('clusterprojecttype:delete');
  });

  it('lists ProjectType and ClusterProjectType as managed entity kinds', () => {
    expect(OPENCHOREO_MANAGED_ENTITY_KINDS).toEqual(
      expect.arrayContaining(['ProjectType', 'ClusterProjectType']),
    );
  });
});

describe('NotificationChannel permissions', () => {
  it('defines notification channel permissions with the expected names and actions', () => {
    expect(openchoreoNotificationChannelCreatePermission.name).toBe(
      'openchoreo.notificationchannel.create',
    );
    expect(openchoreoNotificationChannelReadPermission.name).toBe(
      'openchoreo.notificationchannel.read',
    );
    expect(openchoreoNotificationChannelUpdatePermission.name).toBe(
      'openchoreo.notificationchannel.update',
    );
    expect(openchoreoNotificationChannelDeletePermission.name).toBe(
      'openchoreo.notificationchannel.delete',
    );
  });

  it('registers all four notification channel permissions in openchoreoPermissions', () => {
    const names = openchoreoPermissions.map(p => p.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'openchoreo.notificationchannel.create',
        'openchoreo.notificationchannel.read',
        'openchoreo.notificationchannel.update',
        'openchoreo.notificationchannel.delete',
      ]),
    );
  });

  it('maps notification channel permissions to their authz actions', () => {
    expect(
      OPENCHOREO_PERMISSION_TO_ACTION['openchoreo.notificationchannel.create'],
    ).toBe('observabilityalertsnotificationchannel:create');
    expect(
      OPENCHOREO_PERMISSION_TO_ACTION['openchoreo.notificationchannel.read'],
    ).toBe('observabilityalertsnotificationchannel:view');
    expect(
      OPENCHOREO_PERMISSION_TO_ACTION['openchoreo.notificationchannel.update'],
    ).toBe('observabilityalertsnotificationchannel:update');
    expect(
      OPENCHOREO_PERMISSION_TO_ACTION['openchoreo.notificationchannel.delete'],
    ).toBe('observabilityalertsnotificationchannel:delete');
  });

  it('lists ObservabilityAlertsNotificationChannel as a managed entity kind', () => {
    expect(OPENCHOREO_MANAGED_ENTITY_KINDS).toEqual(
      expect.arrayContaining(['ObservabilityAlertsNotificationChannel']),
    );
  });

  it('bridges catalog.entity.read to the view action', () => {
    expect(
      CATALOG_KIND_TO_ACTION.observabilityalertsnotificationchannel[
        'catalog.entity.read'
      ],
    ).toBe('observabilityalertsnotificationchannel:view');
  });
});
