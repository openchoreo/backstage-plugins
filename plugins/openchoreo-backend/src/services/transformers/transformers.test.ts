import { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';
import { transformProject } from './project';
import { transformComponent } from './component';
import { transformEnvironment } from './environment';
import { transformDataPlane } from './dataplane';
import { transformBuildPlane } from './buildplane';
import { transformObservabilityPlane } from './observabilityplane';
import { transformComponentWorkflowRun } from './workflow-run';
import { transformDeploymentPipeline } from './deployment-pipeline';
import { transformSecretReference } from './secret-reference';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const readyCondition: OpenChoreoComponents['schemas']['Condition'] = {
  type: 'Ready',
  status: 'True',
  lastTransitionTime: '2025-01-06T10:00:05Z',
  reason: 'Reconciled',
  message: 'Resource is ready',
};

const notReadyCondition: OpenChoreoComponents['schemas']['Condition'] = {
  type: 'Ready',
  status: 'False',
  lastTransitionTime: '2025-01-06T10:00:05Z',
  reason: 'Error',
  message: 'Something failed',
};

const baseMeta: OpenChoreoComponents['schemas']['ObjectMeta'] = {
  name: 'test-resource',
  namespace: 'test-ns',
  uid: '550e8400-e29b-41d4-a716-446655440000',
  creationTimestamp: '2025-01-06T10:00:00Z',
  labels: {},
  annotations: {
    'openchoreo.dev/display-name': 'Test Resource',
    'openchoreo.dev/description': 'A test description',
  },
};

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

describe('transformProject', () => {
  const project: OpenChoreoComponents['schemas']['Project'] = {
    metadata: { ...baseMeta, name: 'my-project' },
    spec: { deploymentPipelineRef: 'default' },
    status: { conditions: [readyCondition] },
  };

  it('maps metadata fields correctly', () => {
    const result = transformProject(project);
    expect(result.uid).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result.name).toBe('my-project');
    expect(result.namespaceName).toBe('test-ns');
    expect(result.displayName).toBe('Test Resource');
    expect(result.description).toBe('A test description');
  });

  it('maps spec fields', () => {
    const result = transformProject(project);
    expect(result.deploymentPipeline).toBe('default');
  });

  it('derives status from conditions', () => {
    expect(transformProject(project).status).toBe('Ready');

    const errorProject = {
      ...project,
      status: { conditions: [notReadyCondition] },
    };
    expect(transformProject(errorProject).status).toBe('Error');
  });

  it('handles missing status', () => {
    const noStatus = { metadata: baseMeta };
    expect(transformProject(noStatus).status).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

describe('transformComponent', () => {
  const component: OpenChoreoComponents['schemas']['Component'] = {
    metadata: { ...baseMeta, name: 'api-service' },
    spec: {
      owner: { projectName: 'my-project' },
      componentType: { kind: 'ComponentType', name: 'deployment/go-service' },
      autoDeploy: true,
      workflow: {
        name: 'docker-build',
        systemParameters: {
          repository: {
            url: 'https://github.com/org/repo.git',
            revision: { branch: 'main', commit: 'abc1234' },
            appPath: './services/api',
          },
        },
        parameters: { dockerfile: 'Dockerfile' },
      },
    },
    status: { conditions: [readyCondition] },
  };

  it('maps metadata and ownership', () => {
    const result = transformComponent(component);
    expect(result.uid).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result.name).toBe('api-service');
    expect(result.projectName).toBe('my-project');
    expect(result.namespaceName).toBe('test-ns');
  });

  it('maps type from spec.type first', () => {
    const result = transformComponent(component);
    expect(result.type).toBe('Service');
  });

  it('falls back to componentType when type is absent', () => {
    const noType = {
      ...component,
      spec: { ...component.spec!, type: undefined },
    };
    const result = transformComponent(noType);
    expect(result.type).toBe('deployment/go-service');
  });

  it('maps workflow', () => {
    const result = transformComponent(component);
    expect(result.componentWorkflow).toBeDefined();
    expect(result.componentWorkflow!.name).toBe('docker-build');
    expect(result.componentWorkflow!.systemParameters.repository.url).toBe(
      'https://github.com/org/repo.git',
    );
    expect(
      result.componentWorkflow!.systemParameters.repository.revision.branch,
    ).toBe('main');
    expect(result.componentWorkflow!.parameters).toEqual({
      dockerfile: 'Dockerfile',
    });
  });

  it('maps autoDeploy', () => {
    expect(transformComponent(component).autoDeploy).toBe(true);
  });

  it('handles missing workflow', () => {
    const noWorkflow = {
      ...component,
      spec: { ...component.spec!, workflow: undefined },
    };
    expect(transformComponent(noWorkflow).componentWorkflow).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

describe('transformEnvironment', () => {
  const environment: OpenChoreoComponents['schemas']['Environment'] = {
    metadata: { ...baseMeta, name: 'dev' },
    spec: {
      dataPlaneRef: { kind: 'DataPlane', name: 'default' },
      isProduction: false,
      gateway: {
        ingress: { external: { http: { host: 'dev.example.com' } } },
      },
    },
    status: { conditions: [readyCondition] },
  };

  it('maps all fields', () => {
    const result = transformEnvironment(environment);
    expect(result.uid).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(result.name).toBe('dev');
    expect(result.namespace).toBe('test-ns');
    expect(result.isProduction).toBe(false);
    expect(result.dataPlaneRef).toEqual({
      kind: 'DataPlane',
      name: 'default',
    });
    expect(result.dnsPrefix).toBe('dev.example.com');
    expect(result.status).toBe('Ready');
  });

  it('defaults isProduction to false', () => {
    const noSpec = { metadata: baseMeta };
    expect(transformEnvironment(noSpec).isProduction).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DataPlane
// ---------------------------------------------------------------------------

describe('transformDataPlane', () => {
  const dataPlane: OpenChoreoComponents['schemas']['DataPlane'] = {
    metadata: { ...baseMeta, name: 'prod-dp' },
    spec: {
      clusterAgent: {},
      gateway: {
        ingress: {
          external: {
            http: { host: 'apps.example.com', port: 80 },
            https: { port: 443 },
          },
          internal: {
            http: { host: 'internal.example.com' },
          },
        },
      },
      imagePullSecretRefs: ['docker-secret'],
      secretStoreRef: { name: 'vault-store' },
      observabilityPlaneRef: {
        kind: 'ObservabilityPlane',
        name: 'default-obs',
      },
    },
    status: {
      conditions: [readyCondition],
      agentConnection: {
        connected: true,
        connectedAgents: 2,
        lastConnectedTime: '2025-01-06T10:00:00Z',
      },
    },
  };

  it('maps gateway fields', () => {
    const result = transformDataPlane(dataPlane);
    expect(result.publicVirtualHost).toBe('apps.example.com');
    expect(result.namespaceVirtualHost).toBe('internal.example.com');
    expect(result.publicHTTPPort).toBe(80);
    expect(result.publicHTTPSPort).toBe(443);
  });

  it('maps secretStoreRef to string', () => {
    expect(transformDataPlane(dataPlane).secretStoreRef).toBe('vault-store');
  });

  it('maps observabilityPlaneRef to string', () => {
    expect(transformDataPlane(dataPlane).observabilityPlaneRef).toBe(
      'default-obs',
    );
  });

  it('maps agent connection', () => {
    const result = transformDataPlane(dataPlane);
    expect(result.agentConnection).toEqual({
      connected: true,
      connectedAgents: 2,
      lastConnectedTime: '2025-01-06T10:00:00Z',
    });
  });
});

// ---------------------------------------------------------------------------
// BuildPlane
// ---------------------------------------------------------------------------

describe('transformBuildPlane', () => {
  const buildPlane: OpenChoreoComponents['schemas']['BuildPlane'] = {
    metadata: { ...baseMeta, name: 'ci-bp' },
    spec: {
      clusterAgent: {},
      observabilityPlaneRef: {
        kind: 'ObservabilityPlane',
        name: 'default-obs',
      },
    },
    status: {
      conditions: [readyCondition],
      agentConnection: { connected: true, connectedAgents: 1 },
    },
  };

  it('maps core fields', () => {
    const result = transformBuildPlane(buildPlane);
    expect(result.name).toBe('ci-bp');
    expect(result.namespace).toBe('test-ns');
    expect(result.observabilityPlaneRef).toBe('default-obs');
    expect(result.status).toBe('Ready');
  });

  it('maps agent connection', () => {
    expect(transformBuildPlane(buildPlane).agentConnection?.connected).toBe(
      true,
    );
  });
});

// ---------------------------------------------------------------------------
// ObservabilityPlane
// ---------------------------------------------------------------------------

describe('transformObservabilityPlane', () => {
  const obsPlane: OpenChoreoComponents['schemas']['ObservabilityPlane'] = {
    metadata: { ...baseMeta, name: 'obs-plane' },
    spec: {
      clusterAgent: {},
      observerURL: 'http://observer.svc:8080',
    },
    status: {
      conditions: [readyCondition],
      agentConnection: { connected: true },
    },
  };

  it('maps observer URL', () => {
    expect(transformObservabilityPlane(obsPlane).observerURL).toBe(
      'http://observer.svc:8080',
    );
  });

  it('maps agent connection', () => {
    expect(
      transformObservabilityPlane(obsPlane).agentConnection?.connected,
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ComponentWorkflowRun
// ---------------------------------------------------------------------------

describe('transformComponentWorkflowRun', () => {
  // New K8s-style WorkflowRun with component/project info in labels
  const run: OpenChoreoComponents['schemas']['WorkflowRun'] = {
    metadata: {
      name: 'run-001',
      uid: 'run-uid-001',
      namespace: 'my-ns',
      labels: {
        'openchoreo.dev/component': 'api-service',
        'openchoreo.dev/project': 'my-project',
      },
      annotations: {
        'openchoreo.dev/commit': 'abc1234',
        'openchoreo.dev/image': 'registry.example.com/api-service:abc1234',
      },
      creationTimestamp: '2025-01-06T10:00:00Z',
    },
    spec: {
      workflow: {
        name: 'docker-build',
      },
    },
  };

  it('maps ownership fields', () => {
    const result = transformComponentWorkflowRun(run);
    expect(result.componentName).toBe('api-service');
    expect(result.projectName).toBe('my-project');
  });

  it('maps uuid', () => {
    expect(transformComponentWorkflowRun(run).uuid).toBe('run-uid-001');
  });

  it('maps image', () => {
    expect(transformComponentWorkflowRun(run).image).toBe(
      'registry.example.com/api-service:abc1234',
    );
  });

  it('maps commit', () => {
    expect(transformComponentWorkflowRun(run).commit).toBe('abc1234');
  });

  it('maps workflow config', () => {
    const result = transformComponentWorkflowRun(run);
    expect(result.workflow?.name).toBe('docker-build');
  });

  it('derives status from Ready condition reason', () => {
    const withReason: OpenChoreoComponents['schemas']['WorkflowRun'] = {
      ...run,
      status: {
        conditions: [
          {
            type: 'Ready',
            status: 'False',
            reason: 'BuildFailed',
            lastTransitionTime: '',
          },
        ],
      },
    };
    expect(transformComponentWorkflowRun(withReason).status).toBe(
      'BuildFailed',
    );
  });

  it('derives status as Succeeded when Ready condition is True with no reason', () => {
    const succeeded: OpenChoreoComponents['schemas']['WorkflowRun'] = {
      ...run,
      status: {
        conditions: [
          { type: 'Ready', status: 'True', reason: '', lastTransitionTime: '' },
        ],
      },
    };
    expect(transformComponentWorkflowRun(succeeded).status).toBe('Succeeded');
  });

  it('derives status as Running when Ready condition is False with no reason', () => {
    const running: OpenChoreoComponents['schemas']['WorkflowRun'] = {
      ...run,
      status: {
        conditions: [
          {
            type: 'Ready',
            status: 'False',
            reason: '',
            lastTransitionTime: '',
          },
        ],
      },
    };
    expect(transformComponentWorkflowRun(running).status).toBe('Running');
  });

  it('derives status as Pending when no Ready condition and no timing fields', () => {
    const noCondition: OpenChoreoComponents['schemas']['WorkflowRun'] = {
      ...run,
      status: { conditions: [] },
    };
    expect(transformComponentWorkflowRun(noCondition).status).toBe('Pending');
  });

  it('derives status as Pending when status is absent', () => {
    const noStatus: OpenChoreoComponents['schemas']['WorkflowRun'] = {
      ...run,
      status: undefined,
    };
    expect(transformComponentWorkflowRun(noStatus).status).toBe('Pending');
  });

  it('derives status as Running when startedAt is set but no conditions or completedAt', () => {
    const started: OpenChoreoComponents['schemas']['WorkflowRun'] = {
      ...run,
      status: { conditions: [], startedAt: '2025-01-06T10:00:01Z' },
    };
    expect(transformComponentWorkflowRun(started).status).toBe('Running');
  });

  it('derives status as Succeeded when completedAt is set even if conditions are stale Running', () => {
    const staleRunning: OpenChoreoComponents['schemas']['WorkflowRun'] = {
      ...run,
      status: {
        conditions: [
          {
            type: 'Ready',
            status: 'False',
            reason: 'Running',
            lastTransitionTime: '',
          },
        ],
        startedAt: '2025-01-06T10:00:01Z',
        completedAt: '2025-01-06T10:05:00Z',
      },
    };
    expect(transformComponentWorkflowRun(staleRunning).status).toBe(
      'Succeeded',
    );
  });
});

// ---------------------------------------------------------------------------
// DeploymentPipeline
// ---------------------------------------------------------------------------

describe('transformDeploymentPipeline', () => {
  const pipeline: OpenChoreoComponents['schemas']['DeploymentPipeline'] = {
    metadata: { ...baseMeta, name: 'default' },
    spec: {
      promotionPaths: [
        {
          sourceEnvironmentRef: 'dev',
          targetEnvironmentRefs: [{ name: 'staging', requiresApproval: true }],
        },
      ],
    },
    status: { conditions: [readyCondition] },
  };

  it('maps promotionPaths directly', () => {
    const result = transformDeploymentPipeline(pipeline);
    expect(result.promotionPaths).toHaveLength(1);
    expect(result.promotionPaths![0].sourceEnvironmentRef).toBe('dev');
    expect(result.promotionPaths![0].targetEnvironmentRefs[0].name).toBe(
      'staging',
    );
  });

  it('maps core fields', () => {
    const result = transformDeploymentPipeline(pipeline);
    expect(result.name).toBe('default');
    expect(result.namespaceName).toBe('test-ns');
    expect(result.status).toBe('Ready');
  });
});

// ---------------------------------------------------------------------------
// SecretReference
// ---------------------------------------------------------------------------

describe('transformSecretReference', () => {
  const secret: OpenChoreoComponents['schemas']['SecretReference'] = {
    metadata: { ...baseMeta, name: 'db-secret' },
    spec: {
      template: { type: 'Opaque' },
      data: [
        {
          secretKey: 'password',
          remoteRef: {
            key: 'prod/db/password',
            property: 'value',
            version: '1',
          },
        },
      ],
      refreshInterval: '1h',
    },
    status: {
      conditions: [readyCondition],
      lastRefreshTime: '2025-01-06T11:00:00Z',
      secretStores: [
        { name: 'vault', namespace: 'infra', kind: 'SecretStore' },
      ],
    },
  };

  it('maps data sources', () => {
    const result = transformSecretReference(secret);
    expect(result.data).toHaveLength(1);
    expect(result.data![0].secretKey).toBe('password');
    expect(result.data![0].remoteRef.key).toBe('prod/db/password');
  });

  it('maps secret stores from status', () => {
    const result = transformSecretReference(secret);
    expect(result.secretStores).toHaveLength(1);
    expect(result.secretStores![0].name).toBe('vault');
  });

  it('maps refresh interval', () => {
    expect(transformSecretReference(secret).refreshInterval).toBe('1h');
  });

  it('maps lastRefreshTime from status', () => {
    expect(transformSecretReference(secret).lastRefreshTime).toBe(
      '2025-01-06T11:00:00Z',
    );
  });

  it('maps status string', () => {
    expect(transformSecretReference(secret).status).toBe('Ready');
  });
});
