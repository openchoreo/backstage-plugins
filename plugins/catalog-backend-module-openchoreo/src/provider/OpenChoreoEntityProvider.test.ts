import { ConfigReader } from '@backstage/config';
import { Entity } from '@backstage/catalog-model';
import { OpenChoreoEntityProvider } from './OpenChoreoEntityProvider';

// ---------------------------------------------------------------------------
// Mock the client-node module
// ---------------------------------------------------------------------------

const mockGET = jest.fn();

jest.mock('@openchoreo/openchoreo-client-node', () => ({
  ...jest.requireActual('@openchoreo/openchoreo-client-node'),
  createOpenChoreoApiClient: jest.fn(() => ({
    GET: mockGET,
  })),
  fetchAllPages: jest.fn((fetchPage: (cursor?: string) => Promise<any>) =>
    fetchPage(undefined).then((page: any) => page.items ?? []),
  ),
}));

// ---------------------------------------------------------------------------
// Fixtures — K8s-style resources returned by the new API
// ---------------------------------------------------------------------------

const readyCondition = {
  type: 'Ready',
  status: 'True' as const,
  lastTransitionTime: '2025-01-06T10:00:05Z',
  reason: 'Reconciled',
  message: 'Resource is ready',
};

function k8sMeta(name: string, extra?: Record<string, any>) {
  return {
    name,
    namespace: 'test-ns',
    uid: `uid-${name}`,
    creationTimestamp: '2025-01-06T10:00:00Z',
    labels: {},
    annotations: {
      'openchoreo.dev/display-name': name,
      'openchoreo.dev/description': `${name} description`,
    },
    ...extra,
  };
}

const k8sNamespace = {
  metadata: {
    name: 'test-ns',
    namespace: '',
    uid: 'uid-test-ns',
    creationTimestamp: '2025-01-06T10:00:00Z',
    labels: {},
    annotations: {
      'openchoreo.dev/display-name': 'Test Namespace',
      'openchoreo.dev/description': 'A test namespace',
    },
  },
  status: {
    phase: 'Active',
    conditions: [readyCondition],
  },
};

const k8sEnvironment = {
  metadata: k8sMeta('dev'),
  spec: {
    dataPlaneRef: { kind: 'DataPlane', name: 'default-dp' },
    isProduction: false,
    gateway: { publicVirtualHost: 'dev.example.com' },
  },
  status: { conditions: [readyCondition] },
};

const k8sDataPlane = {
  metadata: k8sMeta('default-dp'),
  spec: {
    gateway: {
      publicVirtualHost: 'api.example.com',
      organizationVirtualHost: 'internal.example.com',
      publicHTTPPort: 80,
      publicHTTPSPort: 443,
    },
    observabilityPlaneRef: { name: 'default-obs' },
  },
  status: {
    conditions: [readyCondition],
    agentConnection: {
      connected: true,
      connectedAgents: 1,
      lastConnectedTime: '2025-01-06T10:00:00Z',
    },
  },
};

const k8sBuildPlane = {
  metadata: k8sMeta('default-bp'),
  spec: {
    observabilityPlaneRef: { name: 'default-obs' },
  },
  status: {
    conditions: [readyCondition],
    agentConnection: { connected: true, connectedAgents: 1 },
  },
};

const k8sObservabilityPlane = {
  metadata: k8sMeta('default-obs'),
  spec: { observerURL: 'https://observer.example.com' },
  status: { conditions: [readyCondition] },
};

const k8sProject = {
  metadata: k8sMeta('my-project'),
  spec: { deploymentPipelineRef: 'default-pipeline' },
  status: { conditions: [readyCondition] },
};

const k8sPipeline = {
  metadata: k8sMeta('default-pipeline'),
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

const k8sServiceComponent = {
  metadata: k8sMeta('api-service'),
  spec: {
    componentType: { kind: 'ComponentType', name: 'Service' },
    owner: { projectName: 'my-project' },
  },
  status: { conditions: [readyCondition] },
};

const k8sNonServiceComponent = {
  metadata: k8sMeta('web-app'),
  spec: {
    componentType: { kind: 'ComponentType', name: 'WebApp' },
    owner: { projectName: 'my-project' },
  },
  status: { conditions: [readyCondition] },
};

const k8sWorkload = {
  metadata: k8sMeta('api-service'),
  spec: {
    endpoints: {
      http: { type: 'REST', port: 8080, visibility: ['external'] },
    },
  },
};

const k8sComponentType = {
  metadata: k8sMeta('go-service'),
  spec: {
    workloadType: 'deployment',
    allowedWorkflows: ['docker-build'],
  },
  status: { conditions: [readyCondition] },
};

const k8sTrait = {
  metadata: k8sMeta('ingress'),
  spec: { schema: { type: 'object' } },
  status: { conditions: [readyCondition] },
};

const k8sWorkflow = {
  metadata: k8sMeta('docker-build'),
  spec: { type: 'Build' },
  status: { conditions: [readyCondition] },
};

const k8sComponentWorkflow = {
  name: 'docker-build',
  displayName: 'Docker Build',
  description: 'Docker build workflow',
  createdAt: '2025-01-06T10:00:00Z',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createConfig() {
  return new ConfigReader({
    openchoreo: {
      baseUrl: 'http://test:8080',
      defaultOwner: 'test-owner',
      componentTypes: {
        mappings: [
          { pattern: 'Service', pageVariant: 'service' },
          { pattern: 'WebApp', pageVariant: 'default' },
        ],
      },
    },
  });
}

/** PersistingTaskRunner — captures scheduled task so we can trigger it manually. */
class PersistingTaskRunner {
  private task?: { fn: () => Promise<void> };
  async run(task: { id: string; fn: () => Promise<void> }) {
    this.task = task;
  }
  async runTask() {
    await this.task?.fn();
  }
}

function mkLogger() {
  return {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    child: jest.fn().mockReturnThis(),
  } as any;
}

function okData(data: any) {
  return { data, error: undefined, response: { ok: true, status: 200 } };
}

function errorData(status = 500) {
  return {
    data: undefined,
    error: { message: 'fail' },
    response: { ok: false, status, statusText: 'Server Error' },
  };
}

/**
 * Path-based mock: mockGET receives (path, options) from openapi-fetch.
 * We inspect the path string to decide what to return.
 *
 * Patterns are checked longest-first so that more specific paths
 * (e.g. `/api/v1/namespaces/{namespaceName}/projects`) match before
 * less specific ones (e.g. `/api/v1/namespaces`).
 */
function setupPathBasedMocks(responses: Record<string, any>) {
  // Sort patterns by length descending so longer (more specific) patterns match first
  const sortedPatterns = Object.keys(responses).sort(
    (a, b) => b.length - a.length,
  );

  mockGET.mockImplementation((path: string, _options?: any) => {
    for (const pattern of sortedPatterns) {
      // Use exact match for the top-level namespaces path to avoid
      // matching sub-resource paths like /namespaces/{ns}/projects
      if (
        path === pattern ||
        (pattern !== '/api/v1/namespaces' && path.includes(pattern))
      ) {
        const response = responses[pattern];
        if (typeof response === 'function') {
          return Promise.resolve(response(path, _options));
        }
        return Promise.resolve(response);
      }
    }
    // Default: return empty list
    return Promise.resolve(okData({ items: [] }));
  });
}

function findEntities(entities: Entity[], kind: string): Entity[] {
  return entities.filter(e => e.kind === kind);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OpenChoreoEntityProvider', () => {
  let taskRunner: PersistingTaskRunner;
  let mockConnection: { applyMutation: jest.Mock; refresh: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    taskRunner = new PersistingTaskRunner();
    mockConnection = {
      applyMutation: jest.fn(),
      refresh: jest.fn(),
    };
  });

  async function runProvider(
    configOverride?: Record<string, any>,
  ): Promise<Entity[]> {
    const config = configOverride
      ? new ConfigReader(configOverride)
      : createConfig();
    const provider = new OpenChoreoEntityProvider(
      taskRunner as any,
      mkLogger(),
      config,
      undefined, // no token service
    );

    await provider.connect(mockConnection as any);
    await taskRunner.runTask();

    // Return entities from the applyMutation call
    const call = mockConnection.applyMutation.mock.calls[0];
    if (!call) return [];
    return call[0].entities.map((e: any) => e.entity);
  }

  describe('full sync — happy path', () => {
    beforeEach(() => {
      setupPathBasedMocks({
        '/api/v1/namespaces/{namespaceName}/environments': okData({
          items: [k8sEnvironment],
        }),
        '/api/v1/namespaces/{namespaceName}/dataplanes': okData({
          items: [k8sDataPlane],
        }),
        '/api/v1/namespaces/{namespaceName}/buildplanes': okData({
          items: [k8sBuildPlane],
        }),
        '/api/v1/namespaces/{namespaceName}/observabilityplanes': okData({
          items: [k8sObservabilityPlane],
        }),
        '/api/v1/namespaces/{namespaceName}/projects': okData({
          items: [k8sProject],
        }),
        '/api/v1/namespaces/{namespaceName}/deploymentpipelines': okData({
          items: [k8sPipeline],
        }),
        '/api/v1/namespaces/{namespaceName}/components': okData({
          items: [k8sServiceComponent, k8sNonServiceComponent],
        }),
        '/api/v1/namespaces/{namespaceName}/workloads': (
          _path: string,
          opts?: any,
        ) => {
          const comp = opts?.params?.query?.component;
          if (comp === 'api-service') {
            return okData({ items: [k8sWorkload] });
          }
          return okData({ items: [] });
        },
        '/api/v1/namespaces/{namespaceName}/componenttypes/{ctName}/schema':
          okData({ type: 'object', properties: {} }),
        '/api/v1/namespaces/{namespaceName}/componenttypes': okData({
          items: [k8sComponentType],
        }),
        '/api/v1/namespaces/{namespaceName}/traits': okData({
          items: [k8sTrait],
        }),
        '/api/v1/namespaces/{namespaceName}/workflows': okData({
          items: [k8sWorkflow],
        }),
        '/api/v1/namespaces/{namespaceName}/component-workflows': okData({
          items: [k8sComponentWorkflow],
        }),
        '/api/v1/namespaces': okData({ items: [k8sNamespace] }),
      });
    });

    it('produces all expected entity kinds', async () => {
      const entities = await runProvider();

      expect(findEntities(entities, 'Domain')).toHaveLength(1);
      expect(findEntities(entities, 'Environment')).toHaveLength(1);
      expect(findEntities(entities, 'Dataplane')).toHaveLength(1);
      expect(findEntities(entities, 'BuildPlane')).toHaveLength(1);
      expect(findEntities(entities, 'ObservabilityPlane')).toHaveLength(1);
      expect(findEntities(entities, 'System')).toHaveLength(1);
      expect(findEntities(entities, 'DeploymentPipeline')).toHaveLength(1);
      expect(findEntities(entities, 'Component')).toHaveLength(2);
      expect(findEntities(entities, 'API')).toHaveLength(1);
      expect(findEntities(entities, 'ComponentType')).toHaveLength(1);
      expect(findEntities(entities, 'TraitType')).toHaveLength(1);
      expect(findEntities(entities, 'Workflow')).toHaveLength(1);
      expect(findEntities(entities, 'ComponentWorkflow')).toHaveLength(1);
    });

    it('creates Domain entity from namespace', async () => {
      const entities = await runProvider();

      const domain = findEntities(entities, 'Domain')[0];
      expect(domain.metadata.name).toBe('test-ns');
      expect(domain.metadata.title).toBe('Test Namespace');
    });

    it('creates Environment entity with correct spec', async () => {
      const entities = await runProvider();

      const env = findEntities(entities, 'Environment')[0];
      expect(env.metadata.name).toBe('dev');
      expect(env.metadata.namespace).toBe('test-ns');
    });

    it('creates Dataplane entity with gateway and agent annotations', async () => {
      const entities = await runProvider();

      const dp = findEntities(entities, 'Dataplane')[0];
      expect(dp.metadata.name).toBe('default-dp');
      expect(dp.metadata.namespace).toBe('test-ns');
      expect(dp.metadata.annotations?.['openchoreo.io/agent-connected']).toBe(
        'true',
      );
    });

    it('creates API entity from workload endpoint', async () => {
      const entities = await runProvider();

      const api = findEntities(entities, 'API')[0];
      expect(api.metadata.name).toBe('api-service-http');
      expect(api.metadata.namespace).toBe('test-ns');
      expect(api.metadata.annotations?.['openchoreo.io/endpoint-type']).toBe(
        'REST',
      );
      expect(api.metadata.annotations?.['openchoreo.io/endpoint-port']).toBe(
        '8080',
      );
      expect((api.spec as any).type).toBe('openapi');
    });

    it('sets providesApis on service component', async () => {
      const entities = await runProvider();

      const serviceComp = findEntities(entities, 'Component').find(
        c => c.metadata.name === 'api-service',
      );
      expect((serviceComp?.spec as any)?.providesApis).toContain(
        'api-service-http',
      );
    });

    it('creates DeploymentPipeline with projectRefs', async () => {
      const entities = await runProvider();

      const pipeline = findEntities(entities, 'DeploymentPipeline')[0];
      expect(pipeline.metadata.name).toBe('default-pipeline');
      expect((pipeline.spec as any).projectRefs).toContain('my-project');
      expect((pipeline.spec as any).promotionPaths).toHaveLength(1);
    });

    it('applies full mutation with correct locationKey', async () => {
      await runProvider();

      expect(mockConnection.applyMutation).toHaveBeenCalledTimes(1);
      const mutation = mockConnection.applyMutation.mock.calls[0][0];
      expect(mutation.type).toBe('full');
      expect(mutation.entities[0].locationKey).toBe(
        'provider:OpenChoreoEntityProvider',
      );
    });
  });

  describe('endpoint type filtering', () => {
    it('filters out non-API endpoint types like HTTP', async () => {
      const httpOnlyWorkload = {
        metadata: k8sMeta('api-service'),
        spec: {
          endpoints: {
            dashboard: { type: 'HTTP', port: 3000, visibility: ['external'] },
          },
        },
      };

      setupPathBasedMocks({
        '/api/v1/namespaces/{namespaceName}/environments': okData({
          items: [k8sEnvironment],
        }),
        '/api/v1/namespaces/{namespaceName}/dataplanes': okData({
          items: [k8sDataPlane],
        }),
        '/api/v1/namespaces/{namespaceName}/buildplanes': okData({
          items: [k8sBuildPlane],
        }),
        '/api/v1/namespaces/{namespaceName}/observabilityplanes': okData({
          items: [k8sObservabilityPlane],
        }),
        '/api/v1/namespaces/{namespaceName}/projects': okData({
          items: [k8sProject],
        }),
        '/api/v1/namespaces/{namespaceName}/deploymentpipelines': okData({
          items: [k8sPipeline],
        }),
        '/api/v1/namespaces/{namespaceName}/components': okData({
          items: [k8sServiceComponent],
        }),
        '/api/v1/namespaces/{namespaceName}/workloads': okData({
          items: [httpOnlyWorkload],
        }),
        '/api/v1/namespaces/{namespaceName}/componenttypes/{ctName}/schema':
          okData({ type: 'object', properties: {} }),
        '/api/v1/namespaces/{namespaceName}/componenttypes': okData({
          items: [k8sComponentType],
        }),
        '/api/v1/namespaces/{namespaceName}/traits': okData({
          items: [k8sTrait],
        }),
        '/api/v1/namespaces/{namespaceName}/workflows': okData({
          items: [k8sWorkflow],
        }),
        '/api/v1/namespaces/{namespaceName}/component-workflows': okData({
          items: [k8sComponentWorkflow],
        }),
        '/api/v1/namespaces': okData({ items: [k8sNamespace] }),
      });

      const entities = await runProvider();

      // HTTP endpoints should be filtered out — no API entities created
      expect(findEntities(entities, 'API')).toHaveLength(0);

      // The component should not have providesApis
      const serviceComp = findEntities(entities, 'Component').find(
        c => c.metadata.name === 'api-service',
      );
      expect((serviceComp?.spec as any)?.providesApis ?? []).toHaveLength(0);
    });

    it('keeps REST, GraphQL, and gRPC endpoints while filtering others', async () => {
      const mixedWorkload = {
        metadata: k8sMeta('api-service'),
        spec: {
          endpoints: {
            rest: { type: 'REST', port: 8080, visibility: ['external'] },
            grpc: { type: 'gRPC', port: 9090, visibility: ['internal'] },
            dashboard: { type: 'HTTP', port: 3000, visibility: ['external'] },
            tcp: { type: 'TCP', port: 5000, visibility: ['internal'] },
          },
        },
      };

      setupPathBasedMocks({
        '/api/v1/namespaces/{namespaceName}/environments': okData({
          items: [k8sEnvironment],
        }),
        '/api/v1/namespaces/{namespaceName}/dataplanes': okData({
          items: [k8sDataPlane],
        }),
        '/api/v1/namespaces/{namespaceName}/buildplanes': okData({
          items: [k8sBuildPlane],
        }),
        '/api/v1/namespaces/{namespaceName}/observabilityplanes': okData({
          items: [k8sObservabilityPlane],
        }),
        '/api/v1/namespaces/{namespaceName}/projects': okData({
          items: [k8sProject],
        }),
        '/api/v1/namespaces/{namespaceName}/deploymentpipelines': okData({
          items: [k8sPipeline],
        }),
        '/api/v1/namespaces/{namespaceName}/components': okData({
          items: [k8sServiceComponent],
        }),
        '/api/v1/namespaces/{namespaceName}/workloads': okData({
          items: [mixedWorkload],
        }),
        '/api/v1/namespaces/{namespaceName}/componenttypes/{ctName}/schema':
          okData({ type: 'object', properties: {} }),
        '/api/v1/namespaces/{namespaceName}/componenttypes': okData({
          items: [k8sComponentType],
        }),
        '/api/v1/namespaces/{namespaceName}/traits': okData({
          items: [k8sTrait],
        }),
        '/api/v1/namespaces/{namespaceName}/workflows': okData({
          items: [k8sWorkflow],
        }),
        '/api/v1/namespaces/{namespaceName}/component-workflows': okData({
          items: [k8sComponentWorkflow],
        }),
        '/api/v1/namespaces': okData({ items: [k8sNamespace] }),
      });

      const entities = await runProvider();

      // Only REST and gRPC should produce API entities (not HTTP or TCP)
      const apis = findEntities(entities, 'API');
      expect(apis).toHaveLength(2);
      const apiNames = apis.map(a => a.metadata.name).sort();
      expect(apiNames).toEqual(['api-service-grpc', 'api-service-rest']);
    });
  });

  describe('pipeline deduplication', () => {
    it('creates single pipeline entity when multiple projects reference it', async () => {
      const project1 = {
        metadata: k8sMeta('project-a'),
        spec: { deploymentPipelineRef: 'shared-pipeline' },
        status: { conditions: [readyCondition] },
      };
      const project2 = {
        metadata: k8sMeta('project-b'),
        spec: { deploymentPipelineRef: 'shared-pipeline' },
        status: { conditions: [readyCondition] },
      };
      const sharedPipeline = {
        metadata: k8sMeta('shared-pipeline'),
        spec: { promotionPaths: [] },
        status: { conditions: [readyCondition] },
      };

      setupPathBasedMocks({
        '/api/v1/namespaces/{namespaceName}/projects': okData({
          items: [project1, project2],
        }),
        '/api/v1/namespaces/{namespaceName}/deploymentpipelines': okData({
          items: [sharedPipeline],
        }),
        '/api/v1/namespaces': okData({ items: [k8sNamespace] }),
      });

      const entities = await runProvider();

      const pipelines = findEntities(entities, 'DeploymentPipeline');
      expect(pipelines).toHaveLength(1);
      expect((pipelines[0].spec as any).projectRefs).toEqual(
        expect.arrayContaining(['project-a', 'project-b']),
      );
    });
  });

  describe('workload fetch failure fallback', () => {
    it('creates component without providesApis when workload fetch fails', async () => {
      setupPathBasedMocks({
        '/api/v1/namespaces/{namespaceName}/projects': okData({
          items: [k8sProject],
        }),
        '/api/v1/namespaces/{namespaceName}/deploymentpipelines': okData({
          items: [k8sPipeline],
        }),
        '/api/v1/namespaces/{namespaceName}/components': okData({
          items: [k8sServiceComponent],
        }),
        '/api/v1/namespaces/{namespaceName}/workloads': errorData(),
        '/api/v1/namespaces': okData({ items: [k8sNamespace] }),
      });

      const entities = await runProvider();

      const components = findEntities(entities, 'Component');
      expect(components).toHaveLength(1);
      expect(components[0].metadata.name).toBe('api-service');
      // No API entities should be created
      expect(findEntities(entities, 'API')).toHaveLength(0);
    });
  });

  describe('namespace-level error isolation', () => {
    it('processes other namespaces when one fails for environments', async () => {
      const nsOk = {
        ...k8sNamespace,
        metadata: { ...k8sNamespace.metadata, name: 'ns-ok' },
      };
      const nsFail = {
        ...k8sNamespace,
        metadata: { ...k8sNamespace.metadata, name: 'ns-fail' },
      };

      // Track calls per namespace for environments
      let envCallCount = 0;
      setupPathBasedMocks({
        '/api/v1/namespaces/{namespaceName}/environments': () => {
          envCallCount++;
          // First call succeeds (ns-ok), second fails (ns-fail)
          if (envCallCount === 1) return okData({ items: [k8sEnvironment] });
          return errorData();
        },
        '/api/v1/namespaces': okData({ items: [nsOk, nsFail] }),
      });

      const entities = await runProvider();

      // Should have 2 Domains (created before per-namespace fetches)
      const domains = findEntities(entities, 'Domain');
      expect(domains).toHaveLength(2);
      // Environment from ns-ok should be present
      expect(findEntities(entities, 'Environment')).toHaveLength(1);
      // applyMutation should still be called
      expect(mockConnection.applyMutation).toHaveBeenCalledTimes(1);
    });
  });

  describe('empty namespace', () => {
    it('creates only Domain entity for namespace with no resources', async () => {
      setupPathBasedMocks({
        '/api/v1/namespaces': okData({ items: [k8sNamespace] }),
        // All other paths return default empty { items: [] }
      });

      const entities = await runProvider();

      expect(findEntities(entities, 'Domain')).toHaveLength(1);
      expect(findEntities(entities, 'System')).toHaveLength(0);
      expect(findEntities(entities, 'Component')).toHaveLength(0);
      expect(findEntities(entities, 'API')).toHaveLength(0);
    });
  });
});
