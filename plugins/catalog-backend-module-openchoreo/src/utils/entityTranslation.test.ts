import {
  translateClusterProjectTypeToEntity,
  translateClusterResourceTypeToEntity,
  translateComponentToEntity,
  translateNewClusterProjectTypeToEntity,
  translateNewClusterResourceTypeToEntity,
  translateNewComponentToEntity,
  translateNewNotificationChannelToEntity,
  translateNewProjectToEntity,
  translateNewProjectTypeToEntity,
  translateNewResourceToEntity,
  translateNewResourceTypeToEntity,
  translateNotificationChannelToEntity,
  translateProjectTypeToEntity,
  translateResourceToEntity,
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
    const without = translateClusterResourceTypeToEntity({ name: 'a' }, config);
    expect(Object.keys(without.metadata.annotations ?? {})).not.toContain(
      'openchoreo.io/deletion-timestamp',
    );

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

describe('translateNewProjectToEntity (project-type linkage)', () => {
  const ctx = {
    providerName: 'openchoreo-provider',
    defaultOwner: 'group:default/team',
  } as any;

  it('stamps project-type / project-type-kind annotations from spec.type', () => {
    const entity = translateNewProjectToEntity(
      {
        apiVersion: 'openchoreo.dev/v1alpha1',
        kind: 'Project',
        metadata: { name: 'payments', namespace: 'default-org' } as any,
        spec: {
          deploymentPipelineRef: { kind: 'DeploymentPipeline', name: 'dp' },
          type: { kind: 'ClusterProjectType', name: 'standard-project' },
        } as any,
      } as any,
      'default-org',
      ctx,
    );

    expect(entity.kind).toBe('System');
    expect(entity.metadata.annotations).toMatchObject({
      'openchoreo.io/project-type': 'standard-project',
      'openchoreo.io/project-type-kind': 'ClusterProjectType',
    });
  });

  it('defaults the kind annotation to ProjectType when only a name is given', () => {
    const entity = translateNewProjectToEntity(
      {
        apiVersion: 'openchoreo.dev/v1alpha1',
        kind: 'Project',
        metadata: { name: 'payments', namespace: 'default-org' } as any,
        spec: { type: { name: 'team-project' } } as any,
      } as any,
      'default-org',
      ctx,
    );
    expect(entity.metadata.annotations).toMatchObject({
      'openchoreo.io/project-type': 'team-project',
      'openchoreo.io/project-type-kind': 'ProjectType',
    });
  });

  it('omits the project-type annotations when spec.type is absent', () => {
    const entity = translateNewProjectToEntity(
      {
        apiVersion: 'openchoreo.dev/v1alpha1',
        kind: 'Project',
        metadata: { name: 'legacy', namespace: 'default-org' } as any,
        spec: {} as any,
      } as any,
      'default-org',
      ctx,
    );
    const keys = Object.keys(entity.metadata.annotations ?? {});
    expect(keys).not.toContain('openchoreo.io/project-type');
    expect(keys).not.toContain('openchoreo.io/project-type-kind');
  });
});

describe('translateClusterProjectTypeToEntity', () => {
  const config = { locationKey: 'openchoreo-provider' };

  it('emits a ClusterProjectType entity with cluster-scoped metadata', () => {
    const entity = translateClusterProjectTypeToEntity(
      {
        name: 'standard-project',
        displayName: 'Standard Project',
        description: 'Baseline project infra',
        createdAt: '2026-06-14T10:00:00Z',
      },
      config,
    );

    expect(entity.apiVersion).toBe('backstage.io/v1alpha1');
    expect(entity.kind).toBe('ClusterProjectType');
    expect(entity.metadata.name).toBe('standard-project');
    expect(entity.metadata.namespace).toBe('openchoreo-cluster');
    expect(entity.metadata.title).toBe('Standard Project');
    expect(entity.metadata.description).toBe('Baseline project infra');
    expect(entity.metadata.tags).toEqual(
      expect.arrayContaining([
        'openchoreo',
        'cluster-project-type',
        'platform-engineering',
      ]),
    );
    expect(entity.metadata.annotations).toMatchObject({
      'backstage.io/managed-by-location': 'provider:openchoreo-provider',
      'backstage.io/managed-by-origin-location': 'provider:openchoreo-provider',
    });
  });

  it('falls back to name when displayName is missing and synthesises a description', () => {
    const entity = translateClusterProjectTypeToEntity(
      { name: 'regulated' },
      config,
    );
    expect(entity.metadata.title).toBe('regulated');
    expect(entity.metadata.description).toBe('regulated cluster project type');
  });

  it('sets the deletion-timestamp annotation only when the input carries one', () => {
    const without = translateClusterProjectTypeToEntity({ name: 'a' }, config);
    expect(Object.keys(without.metadata.annotations ?? {})).not.toContain(
      'openchoreo.io/deletion-timestamp',
    );

    const withTs = translateClusterProjectTypeToEntity(
      { name: 'b', deletionTimestamp: '2026-06-14T11:00:00Z' },
      config,
    );
    expect(withTs.metadata.annotations).toMatchObject({
      'openchoreo.io/deletion-timestamp': '2026-06-14T11:00:00Z',
    });
  });
});

describe('translateNewClusterProjectTypeToEntity', () => {
  it('unwraps the typed-client shape and delegates to the inner translator', () => {
    const entity = translateNewClusterProjectTypeToEntity(
      {
        apiVersion: 'openchoreo.dev/v1alpha1',
        kind: 'ClusterProjectType',
        metadata: {
          name: 'standard-project',
          annotations: {
            'openchoreo.dev/display-name': 'Standard Project',
            'openchoreo.dev/description': 'Baseline project infra',
          },
          creationTimestamp: '2026-06-14T10:00:00Z',
        } as any,
        spec: {
          resources: [],
        } as any,
      } as any,
      { providerName: 'openchoreo-provider' } as any,
    );

    expect(entity.kind).toBe('ClusterProjectType');
    expect(entity.metadata.name).toBe('standard-project');
    expect(entity.metadata.namespace).toBe('openchoreo-cluster');
    expect(entity.metadata.title).toBe('Standard Project');
    expect(entity.metadata.annotations).toMatchObject({
      'backstage.io/managed-by-location': 'provider:openchoreo-provider',
    });
  });
});

describe('translateProjectTypeToEntity', () => {
  const config = { locationKey: 'openchoreo-provider' };

  it('emits a ProjectType entity scoped to its namespace with domain set', () => {
    const entity = translateProjectTypeToEntity(
      {
        name: 'standard-project',
        displayName: 'Standard Project',
        description: 'Baseline project infra',
        createdAt: '2026-06-14T10:00:00Z',
      },
      'default-org',
      config,
    );

    expect(entity.apiVersion).toBe('backstage.io/v1alpha1');
    expect(entity.kind).toBe('ProjectType');
    expect(entity.metadata.name).toBe('standard-project');
    expect(entity.metadata.namespace).toBe('default-org');
    expect(entity.metadata.title).toBe('Standard Project');
    expect(entity.metadata.tags).toEqual(
      expect.arrayContaining([
        'openchoreo',
        'project-type',
        'platform-engineering',
      ]),
    );
    expect(entity.spec.domain).toBe('default/default-org');
    expect(entity.metadata.annotations).toMatchObject({
      'openchoreo.io/namespace': 'default-org',
    });
  });

  it('falls back to name when displayName is missing and synthesises a description', () => {
    const entity = translateProjectTypeToEntity(
      { name: 'regulated' },
      'default-org',
      config,
    );
    expect(entity.metadata.title).toBe('regulated');
    expect(entity.metadata.description).toBe('regulated project type');
  });
});

describe('translateNewProjectTypeToEntity', () => {
  it('unwraps the typed-client shape and delegates to the inner translator', () => {
    const entity = translateNewProjectTypeToEntity(
      {
        apiVersion: 'openchoreo.dev/v1alpha1',
        kind: 'ProjectType',
        metadata: {
          name: 'standard-project',
          namespace: 'default-org',
          annotations: {
            'openchoreo.dev/display-name': 'Standard Project',
          },
          creationTimestamp: '2026-06-14T10:00:00Z',
        } as any,
        spec: {
          resources: [],
        } as any,
      } as any,
      'default-org',
      { providerName: 'openchoreo-provider' } as any,
    );

    expect(entity.kind).toBe('ProjectType');
    expect(entity.metadata.name).toBe('standard-project');
    expect(entity.metadata.namespace).toBe('default-org');
    expect(entity.metadata.title).toBe('Standard Project');
    expect(entity.spec.domain).toBe('default/default-org');
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
    expect(Object.keys(without.metadata.annotations ?? {})).not.toContain(
      'openchoreo.io/deletion-timestamp',
    );

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

describe('translateNotificationChannelToEntity', () => {
  const config = { locationKey: 'openchoreo-provider' };

  it('emits an email channel entity scoped to its namespace', () => {
    const entity = translateNotificationChannelToEntity(
      {
        name: 'dev-email',
        environment: 'dev',
        isEnvDefault: true,
        type: 'email',
        emailConfig: {
          from: 'alerts@example.com',
          to: ['team@example.com'],
          smtp: {
            host: 'smtp.example.com',
            port: 587,
            auth: {
              username: { secretKeyRef: { name: 'smtp-auth', key: 'user' } },
              password: { secretKeyRef: { name: 'smtp-auth', key: 'pass' } },
            },
            tls: { insecureSkipVerify: false },
          },
          template: { subject: 'Alert', body: 'Body' },
        },
        createdAt: '2026-05-14T10:00:00Z',
      },
      'analytics',
      config,
    );

    expect(entity.apiVersion).toBe('backstage.io/v1alpha1');
    expect(entity.kind).toBe('ObservabilityAlertsNotificationChannel');
    expect(entity.metadata.name).toBe('dev-email');
    expect(entity.metadata.namespace).toBe('analytics');
    expect(entity.metadata.tags).toEqual(
      expect.arrayContaining(['openchoreo', 'notification-channel', 'email']),
    );
    expect(entity.metadata.annotations).toMatchObject({
      'backstage.io/managed-by-location': 'provider:openchoreo-provider',
      'openchoreo.io/namespace': 'analytics',
      'openchoreo.io/created-at': '2026-05-14T10:00:00Z',
    });
    expect(entity.spec.environment).toBe('dev');
    expect(entity.spec.isEnvDefault).toBe(true);
    expect(entity.spec.type).toBe('email');
    expect(entity.spec.emailConfig?.from).toBe('alerts@example.com');
    expect(entity.spec.webhookConfig).toBeUndefined();
  });

  it('emits a webhook channel entity without emailConfig', () => {
    const entity = translateNotificationChannelToEntity(
      {
        name: 'dev-webhook',
        environment: 'dev',
        type: 'webhook',
        webhookConfig: {
          url: 'https://hooks.example.com',
          headers: {
            'X-Api-Key': {
              valueFrom: { secretKeyRef: { name: 'webhook-auth', key: 'key' } },
            },
          },
        },
      },
      'analytics',
      config,
    );

    expect(entity.spec.type).toBe('webhook');
    expect(entity.spec.webhookConfig?.url).toBe('https://hooks.example.com');
    expect(entity.spec.emailConfig).toBeUndefined();
    expect(entity.metadata.title).toBe('dev-webhook');
    expect(entity.metadata.description).toBe(
      'dev-webhook notification channel',
    );
  });

  it('sets the deletion-timestamp annotation only when the input carries one', () => {
    const without = translateNotificationChannelToEntity(
      { name: 'a', environment: 'dev', type: 'email' },
      'analytics',
      config,
    );
    expect(Object.keys(without.metadata.annotations ?? {})).not.toContain(
      'openchoreo.io/deletion-timestamp',
    );

    const withTs = translateNotificationChannelToEntity(
      {
        name: 'b',
        environment: 'dev',
        type: 'email',
        deletionTimestamp: '2026-05-14T11:00:00Z',
      },
      'analytics',
      config,
    );
    expect(withTs.metadata.annotations).toMatchObject({
      'openchoreo.io/deletion-timestamp': '2026-05-14T11:00:00Z',
    });
  });
});

describe('translateNewNotificationChannelToEntity', () => {
  it('unwraps the typed-client shape and delegates to the inner translator', () => {
    const entity = translateNewNotificationChannelToEntity(
      {
        metadata: {
          name: 'dev-webhook',
          namespace: 'analytics',
          annotations: {
            'openchoreo.dev/display-name': 'Dev Webhook',
          },
          creationTimestamp: '2026-05-14T10:00:00Z',
        } as any,
        spec: {
          environment: 'dev',
          type: 'webhook',
          webhookConfig: { url: 'https://hooks.example.com' },
        } as any,
      } as any,
      'analytics',
      { providerName: 'openchoreo-provider' } as any,
    );

    expect(entity.kind).toBe('ObservabilityAlertsNotificationChannel');
    expect(entity.metadata.name).toBe('dev-webhook');
    expect(entity.metadata.title).toBe('Dev Webhook');
    expect(entity.spec.type).toBe('webhook');
    expect(entity.spec.webhookConfig?.url).toBe('https://hooks.example.com');
  });

  it('leaves type undefined rather than defaulting to "email" when the API omits spec.type', () => {
    const entity = translateNewNotificationChannelToEntity(
      {
        metadata: { name: 'no-type', namespace: 'analytics' } as any,
        spec: { environment: 'dev' } as any,
      } as any,
      'analytics',
      { providerName: 'openchoreo-provider' } as any,
    );

    expect(entity.spec.type).toBeUndefined();
  });
});

describe('translateResourceToEntity', () => {
  const config = {
    locationKey: 'openchoreo-provider',
    defaultOwner: 'group:default/openchoreo',
  };

  it('emits a Resource entity linked to its project via spec.system', () => {
    const entity = translateResourceToEntity(
      {
        name: 'analytics-db',
        uid: 'res-uid-1',
        displayName: 'Analytics DB',
        description: 'Primary analytics database',
        projectName: 'analytics',
        typeName: 'mysql',
        typeKind: 'ResourceType',
        createdAt: '2026-05-15T10:00:00Z',
      },
      'finance',
      config,
    );

    expect(entity.apiVersion).toBe('backstage.io/v1alpha1');
    expect(entity.kind).toBe('Resource');
    expect(entity.metadata.name).toBe('analytics-db');
    expect(entity.metadata.namespace).toBe('finance');
    expect(entity.metadata.title).toBe('Analytics DB');
    expect(entity.metadata.description).toBe('Primary analytics database');
    expect(entity.metadata.tags).toEqual(
      expect.arrayContaining(['openchoreo', 'resource', 'mysql']),
    );
    expect(entity.metadata.annotations).toMatchObject({
      'backstage.io/managed-by-location': 'provider:openchoreo-provider',
      'backstage.io/managed-by-origin-location': 'provider:openchoreo-provider',
      'openchoreo.io/namespace': 'finance',
      'openchoreo.io/project': 'analytics',
      'openchoreo.io/resource': 'analytics-db',
      'openchoreo.io/resource-uid': 'res-uid-1',
      'openchoreo.io/resource-type': 'mysql',
      'openchoreo.io/resource-type-kind': 'ResourceType',
      'openchoreo.io/created-at': '2026-05-15T10:00:00Z',
    });
    expect(entity.metadata.labels).toMatchObject({
      'openchoreo.io/managed': 'true',
    });
    expect(entity.spec?.type).toBe('mysql');
    expect(entity.spec?.owner).toBe('group:default/openchoreo');
    expect(entity.spec?.system).toBe('analytics');
  });

  it('falls back to name when displayName is missing and synthesises a description', () => {
    const entity = translateResourceToEntity(
      {
        name: 'queue',
        projectName: 'analytics',
        typeName: 'rabbitmq',
        typeKind: 'ResourceType',
      },
      'finance',
      config,
    );
    expect(entity.metadata.title).toBe('queue');
    expect(entity.metadata.description).toBe('queue resource');
  });

  it('records ClusterResourceType in the resource-type-kind annotation', () => {
    const entity = translateResourceToEntity(
      {
        name: 'shared-cache',
        projectName: 'analytics',
        typeName: 'redis',
        typeKind: 'ClusterResourceType',
      },
      'finance',
      config,
    );
    expect(entity.metadata.annotations).toMatchObject({
      'openchoreo.io/resource-type-kind': 'ClusterResourceType',
      'openchoreo.io/resource-type': 'redis',
    });
  });

  it('sets the deletion-timestamp annotation only when the input carries one', () => {
    const without = translateResourceToEntity(
      {
        name: 'a',
        projectName: 'analytics',
        typeName: 'mysql',
        typeKind: 'ResourceType',
      },
      'finance',
      config,
    );
    expect(Object.keys(without.metadata.annotations ?? {})).not.toContain(
      'openchoreo.io/deletion-timestamp',
    );

    const withTs = translateResourceToEntity(
      {
        name: 'b',
        projectName: 'analytics',
        typeName: 'mysql',
        typeKind: 'ResourceType',
        deletionTimestamp: '2026-05-15T11:00:00Z',
      },
      'finance',
      config,
    );
    expect(withTs.metadata.annotations).toMatchObject({
      'openchoreo.io/deletion-timestamp': '2026-05-15T11:00:00Z',
    });
  });

  it('omits the resource-uid annotation when uid is missing', () => {
    const entity = translateResourceToEntity(
      {
        name: 'no-uid',
        projectName: 'analytics',
        typeName: 'mysql',
        typeKind: 'ResourceType',
      },
      'finance',
      config,
    );
    expect(Object.keys(entity.metadata.annotations ?? {})).not.toContain(
      'openchoreo.io/resource-uid',
    );
  });

  it('threads spec.parameters through to the entity when present', () => {
    const entity = translateResourceToEntity(
      {
        name: 'analytics-db',
        projectName: 'analytics',
        typeName: 'postgres',
        typeKind: 'ResourceType',
        parameters: { size: 'small', replicas: 2 },
      },
      'finance',
      config,
    );
    expect((entity.spec as any).parameters).toEqual({
      size: 'small',
      replicas: 2,
    });
  });

  it('omits spec.parameters when parameters is empty', () => {
    const entity = translateResourceToEntity(
      {
        name: 'no-params',
        projectName: 'analytics',
        typeName: 'postgres',
        typeKind: 'ResourceType',
        parameters: {},
      },
      'finance',
      config,
    );
    expect((entity.spec as any).parameters).toBeUndefined();
  });

  it('omits spec.parameters when parameters is not provided', () => {
    const entity = translateResourceToEntity(
      {
        name: 'no-params-arg',
        projectName: 'analytics',
        typeName: 'postgres',
        typeKind: 'ResourceType',
      },
      'finance',
      config,
    );
    expect((entity.spec as any).parameters).toBeUndefined();
  });
});

describe('translateNewResourceToEntity', () => {
  it('unwraps the typed-client ResourceInstance and delegates to the inner translator', () => {
    const entity = translateNewResourceToEntity(
      {
        apiVersion: 'openchoreo.dev/v1alpha1',
        kind: 'Resource',
        metadata: {
          name: 'analytics-db',
          namespace: 'finance',
          uid: 'res-uid-1',
          annotations: {
            'openchoreo.dev/display-name': 'Analytics DB',
            'openchoreo.dev/description': 'Primary analytics database',
          },
          creationTimestamp: '2026-05-15T10:00:00Z',
        } as any,
        spec: {
          owner: { projectName: 'analytics' },
          type: { kind: 'ResourceType', name: 'mysql' },
        } as any,
      } as any,
      'finance',
      {
        providerName: 'openchoreo-provider',
        defaultOwner: 'group:default/openchoreo',
      } as any,
    );

    expect(entity.kind).toBe('Resource');
    expect(entity.metadata.name).toBe('analytics-db');
    expect(entity.metadata.namespace).toBe('finance');
    expect(entity.metadata.title).toBe('Analytics DB');
    expect(entity.spec?.type).toBe('mysql');
    expect(entity.spec?.system).toBe('analytics');
    expect(entity.spec?.owner).toBe('group:default/openchoreo');
    expect(entity.metadata.annotations).toMatchObject({
      'backstage.io/managed-by-location': 'provider:openchoreo-provider',
      'openchoreo.io/project': 'analytics',
      'openchoreo.io/resource': 'analytics-db',
      'openchoreo.io/resource-uid': 'res-uid-1',
      'openchoreo.io/resource-type': 'mysql',
      'openchoreo.io/resource-type-kind': 'ResourceType',
    });
  });

  it('propagates ClusterResourceType kind from the typed-client spec', () => {
    const entity = translateNewResourceToEntity(
      {
        apiVersion: 'openchoreo.dev/v1alpha1',
        kind: 'Resource',
        metadata: {
          name: 'shared-cache',
          namespace: 'finance',
        } as any,
        spec: {
          owner: { projectName: 'analytics' },
          type: { kind: 'ClusterResourceType', name: 'redis' },
        } as any,
      } as any,
      'finance',
      {
        providerName: 'openchoreo-provider',
        defaultOwner: 'group:default/openchoreo',
      } as any,
    );
    expect(entity.metadata.annotations).toMatchObject({
      'openchoreo.io/resource-type-kind': 'ClusterResourceType',
      'openchoreo.io/resource-type': 'redis',
    });
  });

  it('passes spec.parameters from the typed-client spec onto the entity', () => {
    const entity = translateNewResourceToEntity(
      {
        apiVersion: 'openchoreo.dev/v1alpha1',
        kind: 'Resource',
        metadata: {
          name: 'analytics-db',
          namespace: 'finance',
        } as any,
        spec: {
          owner: { projectName: 'analytics' },
          type: { kind: 'ResourceType', name: 'postgres' },
          parameters: { size: 'small', replicas: 2 },
        } as any,
      } as any,
      'finance',
      {
        providerName: 'openchoreo-provider',
        defaultOwner: 'group:default/openchoreo',
      } as any,
    );
    expect((entity.spec as any).parameters).toEqual({
      size: 'small',
      replicas: 2,
    });
  });
});

describe('translateComponentToEntity — spec.dependsOn', () => {
  const config = {
    defaultOwner: 'group:default/openchoreo',
    componentTypeUtils: { generateTags: () => [] } as any,
    locationKey: 'test',
  };

  it('populates spec.dependsOn with the provided refs', () => {
    const entity = translateComponentToEntity(
      { name: 'api', type: 'service' } as any,
      'finance',
      'analytics',
      config,
      undefined,
      undefined,
      ['resource:finance/analytics-db', 'resource:finance/shared-cache'],
    );

    expect((entity.spec as any).dependsOn).toEqual([
      'resource:finance/analytics-db',
      'resource:finance/shared-cache',
    ]);
  });

  it('omits spec.dependsOn when refs are empty', () => {
    const entity = translateComponentToEntity(
      { name: 'api', type: 'service' } as any,
      'finance',
      'analytics',
      config,
      undefined,
      undefined,
      [],
    );

    expect((entity.spec as any).dependsOn).toBeUndefined();
  });

  it('omits spec.dependsOn when refs are not passed', () => {
    const entity = translateComponentToEntity(
      { name: 'api', type: 'service' } as any,
      'finance',
      'analytics',
      config,
    );

    expect((entity.spec as any).dependsOn).toBeUndefined();
  });
});

describe('translateNewComponentToEntity — spec.dependsOn', () => {
  const ctx = {
    providerName: 'openchoreo-provider',
    defaultOwner: 'group:default/openchoreo',
    componentTypeUtils: { generateTags: () => [] } as any,
  };

  it('threads dependsOn refs through to spec.dependsOn', () => {
    const entity = translateNewComponentToEntity(
      {
        apiVersion: 'openchoreo.dev/v1alpha1',
        kind: 'Component',
        metadata: { name: 'api', namespace: 'finance' } as any,
        spec: {
          componentType: { kind: 'ComponentType', name: 'service' },
          owner: { projectName: 'analytics' },
        } as any,
      } as any,
      'finance',
      'analytics',
      'group:default/owner',
      ctx as any,
      undefined,
      undefined,
      undefined,
      ['resource:finance/analytics-db'],
    );

    expect((entity.spec as any).dependsOn).toEqual([
      'resource:finance/analytics-db',
    ]);
  });

  it('omits spec.dependsOn when no refs are passed', () => {
    const entity = translateNewComponentToEntity(
      {
        apiVersion: 'openchoreo.dev/v1alpha1',
        kind: 'Component',
        metadata: { name: 'api', namespace: 'finance' } as any,
        spec: {
          componentType: { kind: 'ComponentType', name: 'service' },
          owner: { projectName: 'analytics' },
        } as any,
      } as any,
      'finance',
      'analytics',
      'group:default/owner',
      ctx as any,
    );

    expect((entity.spec as any).dependsOn).toBeUndefined();
  });
});
