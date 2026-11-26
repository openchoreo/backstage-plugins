import type { Entity } from '@backstage/catalog-model';
import { mockServices } from '@backstage/backend-test-utils';
import type { FactRetrieverContext } from '@backstage-community/plugin-tech-insights-node';
import type { OpenChoreoTokenService } from '@openchoreo/openchoreo-auth';
import { createServiceClient } from './collectOpenChoreoFacts';
import { createOpenChoreoDeploymentFactRetriever } from './openchoreoDeploymentFactRetriever';

const mockGetEntities = jest.fn();
jest.mock('@backstage/catalog-client', () => ({
  CatalogClient: jest.fn().mockImplementation(() => ({
    getEntities: mockGetEntities,
  })),
}));
jest.mock('./collectOpenChoreoFacts', () => ({
  ...jest.requireActual('./collectOpenChoreoFacts'),
  createServiceClient: jest.fn(),
}));

function component(name: string, annotations: Record<string, string>): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: { name, namespace: 'acme', annotations },
  };
}

const annotated = (name: string, project = 'payments') =>
  component(name, {
    'openchoreo.io/namespace': 'acme',
    'openchoreo.io/project': project,
    'openchoreo.io/component': name,
    'openchoreo.io/workload': `${name}-workload`,
  });

const ok = (data: unknown) => ({ data, response: { status: 200 } });
const status = (code: number) => ({
  data: undefined,
  response: { status: code },
});

const releaseLineEntity = (componentName: string, line: string): Entity => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'ReleaseLine',
  metadata: {
    name: line,
    namespace: 'acme',
    annotations: {
      'openchoreo.io/namespace': 'acme',
      'openchoreo.io/project': 'payments',
      'openchoreo.io/component': componentName,
      'openchoreo.io/release-line': line,
    },
  },
});

const readyStatus = {
  conditions: [
    { type: 'ReleaseSynced', status: 'True' },
    { type: 'Ready', status: 'True' },
  ],
};

/** ComponentReleases by name, as `spec.workload` holds them. */
const RELEASES: Record<string, unknown> = {
  r2: {
    container: {
      image: 'ghcr.io/acme/api:1.2.0',
      env: [{ key: 'DB_PASSWORD', value: 'plain' }],
    },
  },
  r1: { container: { image: 'ghcr.io/acme/api:latest' } },
  'next-r5': {
    container: {
      image: 'ghcr.io/acme/api:next',
      env: [{ key: 'API_TOKEN', value: 'plain' }],
    },
  },
};

const ENDPOINTS = [
  {
    metadata: { name: 'api-public' },
    spec: {
      owner: { projectName: 'payments', componentName: 'api' },
      visibility: ['external'],
    },
  },
  {
    metadata: { name: 'api-internal' },
    spec: {
      owner: { projectName: 'payments', componentName: 'api' },
      visibility: ['internal'],
    },
  },
  {
    metadata: { name: 'api-next-public' },
    spec: {
      owner: {
        projectName: 'payments',
        componentName: 'api',
        releaseLineName: 'next',
      },
      visibility: ['external'],
    },
  },
];

const ENDPOINT_BINDINGS: Record<string, string[]> = {
  'api-public': ['production'],
  'api-internal': ['production'],
  'api-next-public': ['production', 'staging'],
  'web-public': ['development'],
};

function fakeClient(options: {
  capabilities?: unknown;
  profile?: () => unknown;
  component?: () => unknown;
  releaseLine?: () => unknown;
  bindings?: () => unknown;
  componentRelease?: (name: string) => unknown;
  endpoints?: () => unknown;
  endpointBindings?: () => unknown;
}) {
  const GET = jest.fn(async (path: string, { params }: any) => {
    switch (path) {
      case '/api/v1/authz/profile':
        return options.profile
          ? options.profile()
          : ok({ capabilities: options.capabilities ?? {} });
      case '/api/v1/namespaces/{namespaceName}/environments':
        return ok({
          items: [
            { metadata: { name: 'production' }, spec: { isProduction: true } },
            { metadata: { name: 'development' }, spec: {} },
          ],
        });
      case '/api/v1/namespaces/{namespaceName}/workloads/{workloadName}':
        return params.path.workloadName === 'gone-workload'
          ? status(404)
          : ok({ spec: { container: { image: 'ghcr.io/acme/api:9.9.9' } } });
      case '/api/v1/namespaces/{namespaceName}/components/{componentName}':
        return options.component
          ? options.component()
          : ok({ status: { latestRelease: { name: 'r2' } } });
      case '/api/v1/namespaces/{namespaceName}/components/{componentName}/releaselines/{releaseLineName}':
        return options.releaseLine
          ? options.releaseLine()
          : ok({ status: { latestRelease: { name: 'next-r5' } } });
      case '/api/v1/namespaces/{namespaceName}/releasebindings':
        if (options.bindings) {
          return options.bindings();
        }
        return ok({
          items: [
            {
              spec: { environment: 'production', releaseName: 'r2' },
              status: readyStatus,
            },
          ],
        });
      case '/api/v1/namespaces/{namespaceName}/componentreleases/{componentReleaseName}': {
        const name = params.path.componentReleaseName;
        if (options.componentRelease) {
          return options.componentRelease(name);
        }
        return RELEASES[name]
          ? ok({ metadata: { name }, spec: { workload: RELEASES[name] } })
          : status(404);
      }
      case '/api/v1/namespaces/{namespaceName}/endpoints':
        return options.endpoints
          ? options.endpoints()
          : ok({ items: ENDPOINTS });
      case '/api/v1/namespaces/{namespaceName}/endpointreleasebindings':
        if (options.endpointBindings) {
          return options.endpointBindings();
        }
        return ok({
          items: Object.entries(ENDPOINT_BINDINGS).flatMap(
            ([endpointName, environments]) =>
              environments.map(environment => ({
                spec: {
                  owner: { projectName: 'payments', endpointName },
                  environment,
                },
              })),
          ),
        });
      default:
        throw new Error(`Unexpected ${path}`);
    }
  });
  return { GET };
}

async function run(entities: Entity[], client: { GET: jest.Mock }) {
  mockGetEntities.mockResolvedValue({ items: entities });
  (createServiceClient as jest.Mock).mockResolvedValue(client);
  const retriever = createOpenChoreoDeploymentFactRetriever(
    {} as OpenChoreoTokenService,
  );
  const logger = mockServices.logger.mock();
  const facts = await retriever.handler({
    config: mockServices.rootConfig(),
    discovery: mockServices.discovery(),
    auth: mockServices.auth(),
    logger,
    entityFilter: retriever.entityFilter,
  } as unknown as FactRetrieverContext);
  return {
    byName: Object.fromEntries(facts.map(f => [f.entity.name, f.facts])),
    logger,
  };
}

const callsTo = (client: { GET: jest.Mock }, path: string) =>
  client.GET.mock.calls.filter(([calledPath]) => calledPath === path);

const RELEASE_PATH =
  '/api/v1/namespaces/{namespaceName}/componentreleases/{componentReleaseName}';
const ENDPOINTS_PATH = '/api/v1/namespaces/{namespaceName}/endpoints';
const ENDPOINT_BINDINGS_PATH =
  '/api/v1/namespaces/{namespaceName}/endpointreleasebindings';

describe('openchoreoDeploymentFactRetriever', () => {
  const allEnvironments = {
    'environment:view': { allowed: [{ path: '*' }] },
  };
  const allBindings = {
    ...allEnvironments,
    'releasebinding:view': { allowed: [{ path: '*' }], denied: [] },
  };
  const allReleases = {
    ...allBindings,
    'componentrelease:view': { allowed: [{ path: '*' }] },
  };
  const everything = {
    ...allReleases,
    'endpoint:view': { allowed: [{ path: '*' }] },
    'endpointreleasebinding:view': { allowed: [{ path: '*' }] },
  };
  const mainAndNextBindings = () =>
    ok({
      items: [
        {
          spec: { environment: 'production', releaseName: 'r2' },
          status: readyStatus,
        },
        {
          spec: {
            owner: { releaseLine: 'next' },
            environment: 'production',
            releaseName: 'next-r5',
          },
          status: readyStatus,
        },
      ],
    });
  const environmentsCalls = (client: { GET: jest.Mock }) =>
    callsTo(client, '/api/v1/namespaces/{namespaceName}/environments');

  it('reports one entry per active binding when everything can be read', async () => {
    const { byName } = await run(
      [annotated('api')],
      fakeClient({ capabilities: everything }),
    );
    expect(byName.api).toEqual({
      openchoreoComponentResolved: true,
      openchoreoEnvironmentDeployments: [
        {
          environment: 'production',
          isProduction: true,
          isReleaseSynced: true,
          isReady: true,
          isOnLatestRelease: true,
          plainTextSecretEnvVarCount: 1,
          isImagePinned: true,
          imageRegistry: 'ghcr.io',
          externalEndpointCount: 1,
        },
      ],
      openchoreoReleasesResolved: true,
    });
  });

  it("sends every request under the entity's deadline", async () => {
    const deadlines: AbortSignal[] = [];
    const timeout = AbortSignal.timeout.bind(AbortSignal);
    const spy = jest
      .spyOn(AbortSignal, 'timeout')
      .mockImplementation(milliseconds => {
        const signal = timeout(milliseconds);
        deadlines.push(signal);
        return signal;
      });
    const client = fakeClient({ capabilities: everything });
    try {
      await run([annotated('api')], client);
    } finally {
      spy.mockRestore();
    }
    expect(deadlines).toHaveLength(1);
    const paths = client.GET.mock.calls.map(([path]) => path);
    expect(paths).toEqual(
      expect.arrayContaining([
        '/api/v1/authz/profile',
        '/api/v1/namespaces/{namespaceName}/environments',
        '/api/v1/namespaces/{namespaceName}/workloads/{workloadName}',
        '/api/v1/namespaces/{namespaceName}/components/{componentName}',
        '/api/v1/namespaces/{namespaceName}/releasebindings',
        RELEASE_PATH,
        ENDPOINTS_PATH,
        ENDPOINT_BINDINGS_PATH,
      ]),
    );
    for (const [, options] of client.GET.mock.calls) {
      expect(options.signal).toBe(deadlines[0]);
    }
  });

  it('reports every field against a control plane with authorization off', async () => {
    const { byName } = await run(
      [annotated('api')],
      fakeClient({ capabilities: { '*': { allowed: [{ path: '*' }] } } }),
    );
    expect(byName.api.openchoreoEnvironmentDeployments).toEqual([
      expect.objectContaining({
        isProduction: true,
        isImagePinned: true,
        externalEndpointCount: 1,
      }),
    ]);
  });

  it('leaves the list out for a project the binding grant does not cover', async () => {
    const { byName } = await run(
      [annotated('api'), annotated('ledger', 'billing')],
      fakeClient({
        capabilities: {
          ...allEnvironments,
          'releasebinding:view': {
            allowed: [{ path: 'ns/acme/project/payments' }],
          },
        },
      }),
    );
    expect(byName.api).toHaveProperty('openchoreoEnvironmentDeployments');
    expect(byName.ledger).toEqual({ openchoreoComponentResolved: true });
  });

  it('leaves the list out when one project is denied under a cluster-wide grant', async () => {
    const { byName } = await run(
      [annotated('api'), annotated('ledger', 'billing')],
      fakeClient({
        capabilities: {
          ...allEnvironments,
          'releasebinding:view': {
            allowed: [{ path: '*' }],
            denied: [{ path: 'ns/acme/project/billing' }],
          },
        },
      }),
    );
    expect(byName.api).toHaveProperty('openchoreoEnvironmentDeployments');
    expect(byName.ledger).not.toHaveProperty(
      'openchoreoEnvironmentDeployments',
    );
  });

  it('reports every fact as null for a component it cannot find', async () => {
    const { byName } = await run(
      [annotated('gone')],
      fakeClient({ capabilities: everything }),
    );
    expect(byName.gone).toEqual({
      openchoreoComponentResolved: false,
      openchoreoEnvironmentDeployments: null,
      openchoreoReleasesResolved: null,
    });
  });

  it('reports nothing for a component OpenChoreo does not manage', async () => {
    const { byName } = await run(
      [component('unannotated', {})],
      fakeClient({ capabilities: everything }),
    );
    expect(byName).not.toHaveProperty('unannotated');
  });

  it('leaves the list out for a line with no active binding', async () => {
    const unbuilt = component('fresh', {
      'openchoreo.io/namespace': 'acme',
      'openchoreo.io/project': 'payments',
      'openchoreo.io/component': 'fresh',
    });
    const client = fakeClient({
      capabilities: everything,
      bindings: () =>
        ok({
          items: [
            {
              spec: {
                environment: 'production',
                releaseName: 'r2',
                state: 'Undeploy',
              },
              status: readyStatus,
            },
          ],
        }),
    });
    const { byName, logger } = await run([unbuilt], client);
    expect(byName.fresh).toEqual({ openchoreoComponentResolved: true });
    expect(callsTo(client, RELEASE_PATH)).toHaveLength(0);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('leaves the list out and warns when the release bindings cannot be listed', async () => {
    const { byName, logger } = await run(
      [annotated('api')],
      fakeClient({ capabilities: everything, bindings: () => status(503) }),
    );
    expect(byName.api).toEqual({ openchoreoComponentResolved: true });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Leaving out deployment facts for api'),
    );
  });

  it('leaves out isOnLatestRelease when OpenChoreo records no latest release', async () => {
    const { byName } = await run(
      [annotated('api')],
      fakeClient({ capabilities: everything, component: () => ok({}) }),
    );
    const [entry] = byName.api.openchoreoEnvironmentDeployments as object[];
    expect(entry).toHaveProperty('isReady', true);
    expect(entry).not.toHaveProperty('isOnLatestRelease');
  });

  it("counts each binding's plain secrets from its release and its own overrides", async () => {
    const client = fakeClient({
      capabilities: everything,
      bindings: () =>
        ok({
          items: [
            {
              spec: { environment: 'development', releaseName: 'r2' },
              status: readyStatus,
            },
            {
              spec: {
                environment: 'production',
                releaseName: 'r2',
                workloadOverrides: {
                  container: { env: [{ key: 'API_KEY', value: 'plain' }] },
                },
              },
              status: readyStatus,
            },
            {
              spec: { environment: 'staging', releaseName: 'r1' },
              status: readyStatus,
            },
          ],
        }),
    });
    const { byName } = await run([annotated('api')], client);
    expect(byName.api.openchoreoEnvironmentDeployments).toEqual([
      expect.objectContaining({
        environment: 'development',
        plainTextSecretEnvVarCount: 1,
        isImagePinned: true,
        isOnLatestRelease: true,
      }),
      expect.objectContaining({
        environment: 'production',
        plainTextSecretEnvVarCount: 2,
        isImagePinned: true,
      }),
      expect.objectContaining({
        environment: 'staging',
        plainTextSecretEnvVarCount: 0,
        isImagePinned: false,
        isOnLatestRelease: false,
      }),
    ]);
    expect(
      callsTo(client, RELEASE_PATH).map(
        ([, { params }]) => params.path.componentReleaseName,
      ),
    ).toEqual(['r2', 'r1']);
  });

  it('leaves out the image and secret fields and warns once per run on a 403 for ComponentReleases', async () => {
    const client = fakeClient({
      capabilities: everything,
      componentRelease: () => status(403),
    });
    const { byName, logger } = await run(
      [annotated('api'), annotated('web')],
      client,
    );
    for (const facts of [byName.api, byName.web]) {
      const [entry] = facts.openchoreoEnvironmentDeployments as object[];
      expect(entry).toEqual({
        environment: 'production',
        isProduction: true,
        isReleaseSynced: true,
        isReady: true,
        isOnLatestRelease: true,
        externalEndpointCount: expect.any(Number),
      });
      expect(facts).not.toHaveProperty('openchoreoReleasesResolved');
    }
    expect(callsTo(client, RELEASE_PATH)).toHaveLength(1);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('componentrelease:view'),
    );
  });

  it('leaves out the image and secret fields when a ComponentRelease fails to load', async () => {
    let calls = 0;
    const client = fakeClient({
      capabilities: everything,
      componentRelease: () => {
        calls += 1;
        return calls === 1
          ? status(500)
          : ok({ spec: { workload: RELEASES.r2 } });
      },
    });
    const { byName, logger } = await run(
      [annotated('api'), annotated('web')],
      client,
    );
    const [apiEntry] = byName.api.openchoreoEnvironmentDeployments as object[];
    expect(apiEntry).not.toHaveProperty('isImagePinned');
    expect(apiEntry).toHaveProperty('isReady', true);
    expect(byName.api).not.toHaveProperty('openchoreoReleasesResolved');
    const [webEntry] = byName.web.openchoreoEnvironmentDeployments as object[];
    expect(webEntry).toHaveProperty('isImagePinned', true);
    expect(byName.web).toHaveProperty('openchoreoReleasesResolved', true);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('GET component release r2 returned HTTP 500'),
    );
  });

  it.each([
    ['no ComponentRelease grant', {}],
    [
      'the component denied under a cluster-wide grant',
      {
        'componentrelease:view': {
          allowed: [{ path: '*' }],
          denied: [{ path: 'ns/acme/project/payments' }],
        },
      },
    ],
  ])(
    'reads no ComponentRelease and warns once per run with %s',
    async (_label, releaseGrant) => {
      const client = fakeClient({
        capabilities: {
          ...allBindings,
          'endpoint:view': { allowed: [{ path: '*' }] },
          'endpointreleasebinding:view': { allowed: [{ path: '*' }] },
          ...releaseGrant,
        },
      });
      const { byName, logger } = await run(
        [annotated('api'), annotated('web')],
        client,
      );
      for (const facts of [byName.api, byName.web]) {
        const [entry] = facts.openchoreoEnvironmentDeployments as object[];
        expect(entry).not.toHaveProperty('isImagePinned');
        expect(entry).not.toHaveProperty('imageRegistry');
        expect(entry).not.toHaveProperty('plainTextSecretEnvVarCount');
        expect(entry).toHaveProperty('isOnLatestRelease', true);
        expect(facts).not.toHaveProperty('openchoreoReleasesResolved');
      }
      expect(callsTo(client, RELEASE_PATH)).toHaveLength(0);
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('componentrelease:view'),
      );
    },
  );

  it('reads ComponentReleases under a grant limited by a CEL condition', async () => {
    const client = fakeClient({
      capabilities: {
        ...allBindings,
        'componentrelease:view': {
          allowed: [
            {
              path: '*',
              constraints: { expressions: ['resource.releaseLine == ""'] },
            },
          ],
        },
      },
    });
    const { byName } = await run([annotated('api')], client);
    const [entry] = byName.api.openchoreoEnvironmentDeployments as object[];
    expect(entry).toHaveProperty('isImagePinned', true);
    expect(byName.api).toHaveProperty('openchoreoReleasesResolved', true);
    expect(callsTo(client, RELEASE_PATH)).toHaveLength(1);
  });

  it('reads a missing ComponentRelease once per run', async () => {
    const client = fakeClient({
      capabilities: everything,
      componentRelease: () => status(404),
    });
    const { byName, logger } = await run(
      [annotated('api'), annotated('web')],
      client,
    );
    for (const facts of [byName.api, byName.web]) {
      const [entry] = facts.openchoreoEnvironmentDeployments as object[];
      expect(entry).not.toHaveProperty('isImagePinned');
      expect(facts).not.toHaveProperty('openchoreoReleasesResolved');
    }
    expect(callsTo(client, RELEASE_PATH)).toHaveLength(1);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('leaves out openchoreoReleasesResolved when one of the releases is missing', async () => {
    const client = fakeClient({
      capabilities: everything,
      bindings: () =>
        ok({
          items: [
            {
              spec: { environment: 'development', releaseName: 'r2' },
              status: readyStatus,
            },
            {
              spec: { environment: 'production', releaseName: 'r9' },
              status: readyStatus,
            },
          ],
        }),
    });
    const { byName } = await run([annotated('api')], client);
    const [development, production] = byName.api
      .openchoreoEnvironmentDeployments as object[];
    expect(development).toHaveProperty('isImagePinned', true);
    expect(production).not.toHaveProperty('isImagePinned');
    expect(byName.api).not.toHaveProperty('openchoreoReleasesResolved');
  });

  it('leaves out openchoreoReleasesResolved for a binding that names no release', async () => {
    const client = fakeClient({
      capabilities: everything,
      bindings: () =>
        ok({
          items: [
            {
              spec: { environment: 'development', releaseName: 'r2' },
              status: readyStatus,
            },
            { spec: { environment: 'production' }, status: readyStatus },
          ],
        }),
    });
    const { byName } = await run([annotated('api')], client);
    expect(byName.api.openchoreoEnvironmentDeployments).toHaveLength(2);
    expect(byName.api).not.toHaveProperty('openchoreoReleasesResolved');
  });

  it('reports openchoreoReleasesResolved beside an Observe binding', async () => {
    const client = fakeClient({
      capabilities: everything,
      bindings: () =>
        ok({
          items: [
            {
              spec: { environment: 'development', releaseName: 'r2' },
              status: readyStatus,
            },
            {
              spec: {
                environment: 'production',
                releaseName: 'r9',
                mode: 'Observe',
              },
              status: readyStatus,
            },
          ],
        }),
    });
    const { byName } = await run([annotated('api')], client);
    expect(byName.api).toHaveProperty('openchoreoReleasesResolved', true);
    expect(
      callsTo(client, RELEASE_PATH).map(
        ([, { params }]) => params.path.componentReleaseName,
      ),
    ).toEqual(['r2']);
  });

  it('counts the external Endpoints the line owns per environment', async () => {
    const client = fakeClient({
      capabilities: everything,
      bindings: () =>
        ok({
          items: [
            {
              spec: { environment: 'development', releaseName: 'r2' },
              status: readyStatus,
            },
            {
              spec: { environment: 'production', releaseName: 'r2' },
              status: readyStatus,
            },
          ],
        }),
    });
    const { byName } = await run([annotated('api')], client);
    expect(byName.api.openchoreoEnvironmentDeployments).toEqual([
      expect.objectContaining({
        environment: 'development',
        externalEndpointCount: 0,
      }),
      expect.objectContaining({
        environment: 'production',
        externalEndpointCount: 1,
      }),
    ]);
    expect(client.GET).toHaveBeenCalledWith(ENDPOINTS_PATH, {
      params: {
        path: { namespaceName: 'acme' },
        query: { project: 'payments', cursor: undefined },
      },
      signal: expect.any(AbortSignal),
    });
    expect(client.GET).toHaveBeenCalledWith(ENDPOINT_BINDINGS_PATH, {
      params: {
        path: { namespaceName: 'acme' },
        query: { cursor: undefined },
      },
      signal: expect.any(AbortSignal),
    });
  });

  it('lists the Endpoint release bindings of a namespace once per run', async () => {
    const client = fakeClient({
      capabilities: everything,
      bindings: mainAndNextBindings,
    });
    const { byName } = await run(
      [annotated('api'), releaseLineEntity('api', 'next'), annotated('web')],
      client,
    );
    const counts = (facts: Record<string, unknown>) =>
      (
        facts.openchoreoEnvironmentDeployments as {
          externalEndpointCount?: number;
        }[]
      ).map(entry => entry.externalEndpointCount);
    expect(counts(byName.api)).toEqual([1]);
    expect(counts(byName.next)).toEqual([1]);
    expect(counts(byName.web)).toEqual([0]);
    expect(callsTo(client, ENDPOINT_BINDINGS_PATH)).toHaveLength(1);
  });

  it('lists no Endpoint release bindings for a line that owns no external Endpoint', async () => {
    const client = fakeClient({ capabilities: everything });
    const { byName } = await run([annotated('web')], client);
    const [entry] = byName.web.openchoreoEnvironmentDeployments as object[];
    expect(entry).toHaveProperty('externalEndpointCount', 0);
    expect(callsTo(client, ENDPOINT_BINDINGS_PATH)).toHaveLength(0);
  });

  it('leaves out externalEndpointCount and lists again after the bindings fail to load', async () => {
    let calls = 0;
    const client = fakeClient({
      capabilities: everything,
      bindings: mainAndNextBindings,
      endpointBindings: () => {
        calls += 1;
        return calls === 1
          ? status(503)
          : ok({
              items: [
                {
                  spec: {
                    owner: {
                      projectName: 'payments',
                      endpointName: 'api-public',
                    },
                    environment: 'production',
                  },
                },
              ],
            });
      },
    });
    const { byName, logger } = await run(
      [annotated('api'), releaseLineEntity('api', 'next')],
      client,
    );
    const [apiEntry] = byName.api.openchoreoEnvironmentDeployments as object[];
    expect(apiEntry).not.toHaveProperty('externalEndpointCount');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Leaving out external endpoint counts for api'),
    );
    const [nextEntry] = byName.next
      .openchoreoEnvironmentDeployments as object[];
    expect(nextEntry).toHaveProperty('externalEndpointCount', 0);
    expect(callsTo(client, ENDPOINT_BINDINGS_PATH)).toHaveLength(2);
  });

  it.each([
    ['no Endpoint grants', {}],
    [
      'Endpoint grants on the component only',
      {
        'endpoint:view': {
          allowed: [{ path: 'ns/acme/project/payments/component/api' }],
        },
        'endpointreleasebinding:view': {
          allowed: [{ path: 'ns/acme/project/payments/component/api' }],
        },
      },
    ],
    [
      'an EndpointReleaseBinding grant limited by a CEL condition',
      {
        'endpoint:view': { allowed: [{ path: '*' }] },
        'endpointreleasebinding:view': {
          allowed: [
            {
              path: '*',
              constraints: {
                expressions: ['resource.environment == "dev"'],
              },
            },
          ],
        },
      },
    ],
  ])('leaves out externalEndpointCount with %s', async (_label, grants) => {
    const client = fakeClient({
      capabilities: { ...allReleases, ...grants },
    });
    const { byName, logger } = await run([annotated('api')], client);
    const [entry] = byName.api.openchoreoEnvironmentDeployments as object[];
    expect(entry).not.toHaveProperty('externalEndpointCount');
    expect(entry).toHaveProperty('isImagePinned', true);
    expect(callsTo(client, ENDPOINTS_PATH)).toHaveLength(0);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('leaves out externalEndpointCount and warns when Endpoints cannot be listed', async () => {
    const { byName, logger } = await run(
      [annotated('api')],
      fakeClient({ capabilities: everything, endpoints: () => status(503) }),
    );
    const [entry] = byName.api.openchoreoEnvironmentDeployments as object[];
    expect(entry).not.toHaveProperty('externalEndpointCount');
    expect(entry).toHaveProperty('isImagePinned', true);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Leaving out external endpoint counts for api'),
    );
  });

  it('reads no release for an Observe binding and leaves out what it does not render', async () => {
    const client = fakeClient({
      capabilities: everything,
      bindings: () =>
        ok({
          items: [
            {
              spec: {
                environment: 'production',
                releaseName: 'r2',
                mode: 'Observe',
              },
              status: readyStatus,
            },
          ],
        }),
    });
    const { byName } = await run([annotated('api')], client);
    expect(byName.api.openchoreoEnvironmentDeployments).toEqual([
      {
        environment: 'production',
        isProduction: true,
        isReleaseSynced: true,
        isReady: true,
        externalEndpointCount: 1,
      },
    ]);
    expect(byName.api).not.toHaveProperty('openchoreoReleasesResolved');
    expect(callsTo(client, RELEASE_PATH)).toHaveLength(0);
  });

  it('keeps the resolved fact and retries the namespace after a failed load', async () => {
    let calls = 0;
    const client = fakeClient({
      profile: () => {
        calls += 1;
        return calls === 1 ? status(503) : ok({ capabilities: everything });
      },
    });
    const { byName, logger } = await run(
      [annotated('api'), annotated('web')],
      client,
    );
    expect(byName.api).toEqual({ openchoreoComponentResolved: true });
    expect(byName.web).toHaveProperty('openchoreoEnvironmentDeployments');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Leaving out deployment facts for api'),
    );
  });

  it('reports the list when environments are granted on the namespace', async () => {
    const client = fakeClient({
      capabilities: {
        ...everything,
        'environment:view': { allowed: [{ path: 'ns/acme' }] },
      },
    });
    const { byName } = await run([annotated('api')], client);
    expect(byName.api).toHaveProperty('openchoreoEnvironmentDeployments');
    expect(environmentsCalls(client)).toHaveLength(1);
  });

  it.each([
    ['no environment grant', {}],
    [
      'an environment grant on another namespace',
      { 'environment:view': { allowed: [{ path: 'ns/other' }] } },
    ],
    [
      'an environment grant on a project only',
      {
        'environment:view': {
          allowed: [{ path: 'ns/acme/project/payments' }],
        },
      },
    ],
    [
      'an environment grant limited by a CEL condition',
      {
        'environment:view': {
          allowed: [
            {
              path: '*',
              constraints: { expressions: ['resource.environment == "dev"'] },
            },
          ],
        },
      },
    ],
  ])('leaves the list out with %s', async (_label, environmentGrant) => {
    const client = fakeClient({
      capabilities: {
        'releasebinding:view': { allowed: [{ path: '*' }] },
        ...environmentGrant,
      },
    });
    const { byName, logger } = await run(
      [annotated('api'), annotated('web')],
      client,
    );
    for (const facts of [byName.api, byName.web]) {
      expect(facts).toEqual({ openchoreoComponentResolved: true });
    }
    expect(environmentsCalls(client)).toHaveLength(0);
    expect(callsTo(client, '/api/v1/authz/profile')).toHaveLength(1);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it.each([403, 404])(
    'leaves the list out when the component GET returns %i',
    async code => {
      const { byName, logger } = await run(
        [annotated('api')],
        fakeClient({
          capabilities: everything,
          component: () => status(code),
        }),
      );
      expect(byName.api).toEqual({ openchoreoComponentResolved: true });
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          `Leaving out deployment facts for api: GET component returned HTTP ${code}`,
        ),
      );
    },
  );

  describe('release lines', () => {
    const bindings = () =>
      ok({
        items: [
          {
            spec: { environment: 'development', releaseName: 'r2' },
            status: readyStatus,
          },
          {
            spec: {
              owner: { releaseLine: 'next' },
              environment: 'production',
              releaseName: 'next-r5',
              workloadOverrides: {
                container: { env: [{ key: 'DB_PASSWORD', value: 'plain' }] },
              },
            },
            status: readyStatus,
          },
          {
            spec: {
              owner: { releaseLine: 'canary' },
              environment: 'staging',
              releaseName: 'canary-r1',
            },
            status: readyStatus,
          },
        ],
      });

    it("reports a component's main line only", async () => {
      const { byName } = await run(
        [annotated('api')],
        fakeClient({ capabilities: everything, bindings }),
      );
      expect(byName.api.openchoreoEnvironmentDeployments).toEqual([
        {
          environment: 'development',
          isProduction: false,
          isReleaseSynced: true,
          isReady: true,
          isOnLatestRelease: true,
          plainTextSecretEnvVarCount: 1,
          isImagePinned: true,
          imageRegistry: 'ghcr.io',
          externalEndpointCount: 0,
        },
      ]);
    });

    it('reports a release line from its own bindings, releases, Endpoints and latest release', async () => {
      const client = fakeClient({ capabilities: everything, bindings });
      const { byName } = await run([releaseLineEntity('api', 'next')], client);
      expect(byName.next).toEqual({
        openchoreoComponentResolved: true,
        openchoreoEnvironmentDeployments: [
          {
            environment: 'production',
            isProduction: true,
            isReleaseSynced: true,
            isReady: true,
            isOnLatestRelease: true,
            plainTextSecretEnvVarCount: 2,
            isImagePinned: true,
            imageRegistry: 'ghcr.io',
            externalEndpointCount: 1,
          },
        ],
        openchoreoReleasesResolved: true,
      });
      expect(client.GET).toHaveBeenCalledWith(
        '/api/v1/namespaces/{namespaceName}/components/{componentName}/releaselines/{releaseLineName}',
        {
          params: {
            path: {
              namespaceName: 'acme',
              componentName: 'api',
              releaseLineName: 'next',
            },
          },
          signal: expect.any(AbortSignal),
        },
      );
      expect(callsTo(client, ENDPOINT_BINDINGS_PATH)).toHaveLength(1);
      expect(
        client.GET.mock.calls.some(([path]) => path.includes('/workloads')),
      ).toBe(false);
    });

    it('leaves out the image fields of a release line whose release is missing', async () => {
      const { byName } = await run(
        [releaseLineEntity('api', 'canary')],
        fakeClient({
          capabilities: everything,
          bindings,
          releaseLine: () => ok({}),
        }),
      );
      const [entry] = byName.canary
        .openchoreoEnvironmentDeployments as object[];
      expect(entry).toEqual({
        environment: 'staging',
        isProduction: false,
        isReleaseSynced: true,
        isReady: true,
        externalEndpointCount: 0,
      });
      expect(byName.canary).not.toHaveProperty('openchoreoReleasesResolved');
    });

    it('leaves the list out when the release line cannot be read', async () => {
      const { byName, logger } = await run(
        [releaseLineEntity('api', 'next')],
        fakeClient({
          capabilities: everything,
          releaseLine: () => status(404),
        }),
      );
      expect(byName.next).toEqual({ openchoreoComponentResolved: true });
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Leaving out deployment facts for api:next: GET release line returned HTTP 404',
        ),
      );
    });

    it('lists the bindings of a component and the Endpoints of a project once for all lines', async () => {
      const client = fakeClient({ capabilities: everything, bindings });
      const { byName } = await run(
        [
          annotated('api'),
          releaseLineEntity('api', 'next'),
          releaseLineEntity('api', 'canary'),
        ],
        client,
      );
      const environments = (facts: Record<string, unknown>) =>
        (
          facts.openchoreoEnvironmentDeployments as { environment: string }[]
        ).map(entry => entry.environment);
      expect(environments(byName.api)).toEqual(['development']);
      expect(environments(byName.next)).toEqual(['production']);
      expect(environments(byName.canary)).toEqual(['staging']);
      expect(
        callsTo(client, '/api/v1/namespaces/{namespaceName}/releasebindings'),
      ).toHaveLength(1);
      expect(callsTo(client, ENDPOINTS_PATH)).toHaveLength(1);
    });

    it('keeps only the resolved fact of a release line when the authz profile cannot be read', async () => {
      const { byName, logger } = await run(
        [releaseLineEntity('api', 'next')],
        fakeClient({ profile: () => status(503) }),
      );
      expect(byName.next).toEqual({ openchoreoComponentResolved: true });
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Leaving out deployment facts for api:next: GET authz profile for namespace acme returned HTTP 503',
        ),
      );
    });

    it('reports nothing for a ReleaseLine that names no line', async () => {
      const line = releaseLineEntity('api', 'next');
      delete line.metadata.annotations!['openchoreo.io/release-line'];
      const client = fakeClient({ capabilities: everything });
      const { byName } = await run([line], client);
      expect(byName).not.toHaveProperty('next');
      expect(client.GET).not.toHaveBeenCalled();
    });
  });
});
