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

function fakeClient(options: {
  capabilities?: unknown;
  profile?: () => unknown;
  component?: () => unknown;
  bindings?: () => unknown;
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
          ],
        });
      case '/api/v1/namespaces/{namespaceName}/workloads/{workloadName}':
        return params.path.workloadName === 'gone-workload'
          ? status(404)
          : ok({ spec: { container: { image: 'ghcr.io/acme/api:1.2.0' } } });
      case '/api/v1/namespaces/{namespaceName}/components/{componentName}':
        return options.component
          ? options.component()
          : ok({ status: { latestRelease: { name: 'r2' } } });
      case '/api/v1/namespaces/{namespaceName}/releasebindings':
        if (options.bindings) {
          return options.bindings();
        }
        return ok({
          items: [
            {
              spec: { environment: 'production', releaseName: 'r2' },
              status: { conditions: [{ type: 'Ready', status: 'True' }] },
            },
          ],
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

describe('openchoreoDeploymentFactRetriever', () => {
  const allEnvironments = {
    'environment:view': { allowed: [{ path: '*' }] },
  };
  const allBindings = {
    ...allEnvironments,
    'releasebinding:view': { allowed: [{ path: '*' }], denied: [] },
  };
  const environmentsCalls = (client: { GET: jest.Mock }) =>
    client.GET.mock.calls.filter(
      ([path]) => path === '/api/v1/namespaces/{namespaceName}/environments',
    );

  it('reports binding facts when every binding can be read', async () => {
    const { byName } = await run(
      [annotated('api')],
      fakeClient({ capabilities: allBindings }),
    );
    expect(byName.api).toEqual(
      expect.objectContaining({
        openchoreoComponentResolved: true,
        openchoreoDeployedToProduction: true,
        openchoreoReadyInAllEnvironments: true,
        openchoreoRunsLatestRelease: true,
      }),
    );
  });

  it("sends every request under the entity's deadline", async () => {
    const client = fakeClient({ capabilities: allBindings });
    await run([annotated('api')], client);
    const paths = client.GET.mock.calls.map(([path]) => path);
    expect(paths).toEqual(
      expect.arrayContaining([
        '/api/v1/authz/profile',
        '/api/v1/namespaces/{namespaceName}/environments',
        '/api/v1/namespaces/{namespaceName}/workloads/{workloadName}',
        '/api/v1/namespaces/{namespaceName}/components/{componentName}',
        '/api/v1/namespaces/{namespaceName}/releasebindings',
      ]),
    );
    for (const [, options] of client.GET.mock.calls) {
      expect(options.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it('reports binding facts against a control plane with authorization off', async () => {
    const { byName } = await run(
      [annotated('api')],
      fakeClient({ capabilities: { '*': { allowed: [{ path: '*' }] } } }),
    );
    expect(byName.api).toHaveProperty('openchoreoDeployedToProduction', true);
  });

  it('leaves binding facts out for a project the grant does not cover', async () => {
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
    expect(byName.api).toHaveProperty('openchoreoDeployedToProduction');
    expect(byName.ledger).not.toHaveProperty('openchoreoDeployedToProduction');
    expect(byName.ledger).toHaveProperty('openchoreoImagePinned', true);
  });

  it('leaves binding facts out when one project is denied under a cluster-wide grant', async () => {
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
    expect(byName.api).toHaveProperty('openchoreoDeployedToProduction', true);
    expect(byName.ledger).not.toHaveProperty('openchoreoDeployedToProduction');
  });

  it('reports every fact as null for a component it cannot find', async () => {
    const { byName } = await run(
      [annotated('gone')],
      fakeClient({ capabilities: allBindings }),
    );
    expect(byName.gone.openchoreoComponentResolved).toBe(false);
    expect(byName.gone.openchoreoImagePinned).toBeNull();
    expect(byName.gone.openchoreoDeployedToProduction).toBeNull();
  });

  it('reports nothing for a component OpenChoreo does not manage', async () => {
    const { byName } = await run(
      [component('unannotated', {})],
      fakeClient({ capabilities: allBindings }),
    );
    expect(byName).not.toHaveProperty('unannotated');
  });

  it('reports deployment facts for a component that has no Workload yet', async () => {
    const unbuilt = component('fresh', {
      'openchoreo.io/namespace': 'acme',
      'openchoreo.io/project': 'payments',
      'openchoreo.io/component': 'fresh',
    });
    const { byName } = await run(
      [unbuilt],
      fakeClient({
        capabilities: allBindings,
        bindings: () => ok({ items: [] }),
      }),
    );
    expect(byName.fresh).toMatchObject({
      openchoreoComponentResolved: true,
      openchoreoDeployedToProduction: false,
      openchoreoDeployedEnvironments: [],
    });
    expect(byName.fresh).not.toHaveProperty('openchoreoImagePinned');
    expect(byName.fresh).not.toHaveProperty(
      'openchoreoPlainTextSecretEnvCount',
    );
  });

  it('keeps Workload facts when the release bindings cannot be listed', async () => {
    const { byName, logger } = await run(
      [annotated('api')],
      fakeClient({ capabilities: allBindings, bindings: () => status(503) }),
    );
    expect(byName.api).toHaveProperty('openchoreoImagePinned', true);
    expect(byName.api).not.toHaveProperty('openchoreoDeployedToProduction');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Leaving out deployment facts for api'),
    );
  });

  it('leaves out the latest-release fact when OpenChoreo records none', async () => {
    const { byName } = await run(
      [annotated('api')],
      fakeClient({ capabilities: allBindings, component: () => ok({}) }),
    );
    expect(byName.api).toHaveProperty('openchoreoDeployedToProduction', true);
    expect(byName.api).not.toHaveProperty('openchoreoRunsLatestRelease');
  });

  it('counts plain secrets set in a release binding override', async () => {
    const { byName } = await run(
      [annotated('api')],
      fakeClient({
        capabilities: allBindings,
        bindings: () =>
          ok({
            items: [
              {
                spec: {
                  environment: 'production',
                  releaseName: 'r2',
                  workloadOverrides: {
                    container: { env: [{ key: 'DB_PASS', value: 'hunter2' }] },
                  },
                },
              },
            ],
          }),
      }),
    );
    expect(byName.api).toHaveProperty('openchoreoPlainTextSecretEnvCount', 1);
  });

  it('keeps Workload facts and retries the namespace after a failed load', async () => {
    let calls = 0;
    const client = fakeClient({
      profile: () => {
        calls += 1;
        return calls === 1 ? status(503) : ok({ capabilities: allBindings });
      },
    });
    const { byName, logger } = await run(
      [annotated('api'), annotated('web')],
      client,
    );
    expect(byName.api).toHaveProperty('openchoreoImagePinned', true);
    expect(byName.api).not.toHaveProperty('openchoreoDeployedToProduction');
    expect(byName.web).toHaveProperty('openchoreoDeployedToProduction', true);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Leaving out deployment facts for api'),
    );
  });

  it('reports binding facts when environments are granted on the namespace', async () => {
    const client = fakeClient({
      capabilities: {
        ...allBindings,
        'environment:view': { allowed: [{ path: 'ns/acme' }] },
      },
    });
    const { byName } = await run([annotated('api')], client);
    expect(byName.api).toHaveProperty('openchoreoDeployedToProduction', true);
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
  ])('keeps only Workload facts with %s', async (_label, environmentGrant) => {
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
      expect(facts).toHaveProperty('openchoreoImagePinned', true);
      expect(facts).not.toHaveProperty('openchoreoDeployedToProduction');
    }
    expect(environmentsCalls(client)).toHaveLength(0);
    expect(
      client.GET.mock.calls.filter(
        ([path]) => path === '/api/v1/authz/profile',
      ),
    ).toHaveLength(1);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it.each([403, 404])(
    'keeps only Workload facts when the component GET returns %i',
    async code => {
      const { byName, logger } = await run(
        [annotated('api')],
        fakeClient({
          capabilities: allBindings,
          component: () => status(code),
        }),
      );
      expect(byName.api).toHaveProperty('openchoreoComponentResolved', true);
      expect(byName.api).toHaveProperty('openchoreoImagePinned', true);
      expect(byName.api).not.toHaveProperty('openchoreoDeployedToProduction');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          `Leaving out deployment facts for api: GET component returned HTTP ${code}`,
        ),
      );
    },
  );
});
