import type { Entity } from '@backstage/catalog-model';
import { mockServices } from '@backstage/backend-test-utils';
import type { FactRetrieverContext } from '@backstage-community/plugin-tech-insights-node';
import type { OpenChoreoTokenService } from '@openchoreo/openchoreo-auth';
import { createObservabilityClientWithUrl } from '@openchoreo/openchoreo-client-node';
import { createServiceClient } from './collectOpenChoreoFacts';
import { createOpenChoreoAlertingFactRetriever } from './openchoreoAlertingFactRetriever';

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
jest.mock('@openchoreo/openchoreo-client-node', () => ({
  ...jest.requireActual('@openchoreo/openchoreo-client-node'),
  createObservabilityClientWithUrl: jest.fn(),
}));

const PATHS = {
  component: '/api/v1/namespaces/{namespaceName}/components/{componentName}',
  releaseLine:
    '/api/v1/namespaces/{namespaceName}/components/{componentName}/releaselines/{releaseLineName}',
  componentType: '/api/v1/namespaces/{namespaceName}/componenttypes/{ctName}',
  trait: '/api/v1/namespaces/{namespaceName}/traits/{traitName}',
  clusterTrait: '/api/v1/clustertraits/{clusterTraitName}',
  bindings: '/api/v1/namespaces/{namespaceName}/releasebindings',
  environment: '/api/v1/namespaces/{namespaceName}/environments/{envName}',
  dataPlane: '/api/v1/namespaces/{namespaceName}/dataplanes/{dpName}',
  clusterDataPlane: '/api/v1/clusterdataplanes/{cdpName}',
  observabilityPlane:
    '/api/v1/namespaces/{namespaceName}/observabilityplanes/{observabilityPlaneName}',
  clusterObservabilityPlane:
    '/api/v1/clusterobservabilityplanes/{clusterObservabilityPlaneName}',
  profile: '/api/v1/authz/profile',
};

const allBindings = {
  'environment:view': { allowed: [{ path: 'ns/acme' }], denied: [] },
  'releasebinding:view': { allowed: [{ path: '*' }], denied: [] },
};

const ALERTS = '/api/v1alpha1/alerts/query';
const INCIDENTS = '/api/v1alpha1/incidents/query';
const OBSERVER_A = 'http://observer-a:8080';
const OBSERVER_B = 'http://observer-b:8080';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const ok = (data: unknown) => ({ data, response: { status: 200 } });
const status = (code: number, error?: unknown) => ({
  data: undefined,
  error,
  response: { status: code },
});

const annotations = {
  'openchoreo.io/namespace': 'acme',
  'openchoreo.io/project': 'payments',
  'openchoreo.io/component': 'api',
};
const mainLine: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'api', namespace: 'acme', annotations },
};
const releaseLine: Entity = {
  apiVersion: 'openchoreo.io/v1alpha1',
  kind: 'ReleaseLine',
  metadata: {
    name: 'api-experimental',
    namespace: 'acme',
    annotations: {
      ...annotations,
      'openchoreo.io/release-line': 'experimental',
    },
  },
};

const binding = (environment: string, line?: string, state = 'Active') => ({
  spec: {
    environment,
    state,
    ...(line && { owner: { releaseLine: line } }),
  },
});

const alertRuleTrait = {
  spec: { creates: [{ template: { kind: 'ObservabilityAlertRule' } }] },
};

type Handler = (params: any) => unknown;

/** OpenChoreo resources for one component with alert rules, bound to dev and prod. */
function defaultRoutes(): Record<string, Handler> {
  return {
    [PATHS.component]: () =>
      ok({
        spec: {
          owner: { projectName: 'payments' },
          componentType: { kind: 'ComponentType', name: 'deployment/service' },
          traits: [
            { kind: 'Trait', name: 'alert-rule', instanceName: 'latency' },
            { kind: 'Trait', name: 'autoscaler', instanceName: 'hpa' },
          ],
        },
      }),
    [PATHS.releaseLine]: () =>
      ok({
        spec: {
          traits: [
            { kind: 'Trait', name: 'alert-rule', instanceName: 'latency' },
            { name: 'alert-rule', instanceName: 'errors' },
          ],
        },
      }),
    [PATHS.componentType]: () =>
      ok({
        spec: {
          traits: [
            {
              kind: 'ClusterTrait',
              name: 'default-alerts',
              instanceName: 'defaults',
            },
          ],
        },
      }),
    [PATHS.trait]: ({ path }) =>
      path.traitName === 'alert-rule'
        ? ok(alertRuleTrait)
        : ok({ spec: { creates: [{ template: { kind: 'HPA' } }] } }),
    [PATHS.clusterTrait]: () => ok(alertRuleTrait),
    [PATHS.bindings]: () =>
      ok({
        items: [
          binding('dev'),
          binding('prod'),
          binding('staging', undefined, 'Undeploy'),
          binding('dev', 'experimental'),
        ],
      }),
    [PATHS.environment]: ({ path }) =>
      ok({ spec: { isProduction: path.envName === 'prod' } }),
    [PATHS.dataPlane]: () => ok({ spec: {} }),
    [PATHS.observabilityPlane]: () => ok({ spec: { observerURL: OBSERVER_A } }),
    [PATHS.clusterDataPlane]: () => ok({ spec: {} }),
    [PATHS.clusterObservabilityPlane]: () =>
      ok({ spec: { observerURL: OBSERVER_B } }),
    [PATHS.profile]: () => ok({ capabilities: allBindings }),
  };
}

function fakeClient(overrides: Record<string, Handler> = {}) {
  const routes = { ...defaultRoutes(), ...overrides };
  const GET = jest.fn(async (path: string, { params }: any) => {
    const route = routes[path];
    if (!route) {
      throw new Error(`Unexpected ${path}`);
    }
    return route(params);
  });
  return { GET };
}

const alertsResponse = {
  alerts: [
    { metadata: { alertRule: { severity: 'critical' } } },
    { metadata: { alertRule: { severity: 'warning' } } },
  ],
  total: 2,
};
const incidentsResponse = {
  incidents: [
    { status: 'active' },
    { status: 'acknowledged' },
    { status: 'resolved' },
  ],
  total: 3,
};
const COUNTS = {
  alertsFiredLast30Days: 2,
  criticalAlertsLast30Days: 1,
  incidentsLast30Days: 3,
  openIncidentsLast30Days: 2,
  unacknowledgedIncidentsLast30Days: 1,
};

type ObserverHandler = (
  path: string,
  body: any,
  request: { url: string; signal: AbortSignal },
) => unknown;

const answer: ObserverHandler = path =>
  ok(path === ALERTS ? alertsResponse : incidentsResponse);

/** A request that never answers, rejecting only once its signal aborts. */
const hang: ObserverHandler = (_path, _body, { signal }) =>
  new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), {
      once: true,
    });
  });

/** Observer clients by URL, all answering with `handler`. */
function fakeObservers(handler: ObserverHandler = answer) {
  const clients = new Map<string, { POST: jest.Mock }>();
  (createObservabilityClientWithUrl as jest.Mock).mockImplementation(
    (url: string) => {
      const client = {
        POST: jest.fn(async (path: string, { body, signal }: any) =>
          handler(path, body, { url, signal }),
        ),
      };
      clients.set(url, client);
      return client;
    },
  );
  const posts = () =>
    [...clients.entries()].flatMap(([url, client]) =>
      client.POST.mock.calls.map(([path, options]) => ({
        url,
        path,
        options,
      })),
    );
  return { clients, posts };
}

async function run(
  entities: Entity[],
  client: { GET: jest.Mock },
  observers = fakeObservers(),
  options?: Parameters<typeof createOpenChoreoAlertingFactRetriever>[1],
) {
  mockGetEntities.mockResolvedValue({ items: entities });
  (createServiceClient as jest.Mock).mockResolvedValue(client);
  const tokenService = {
    hasServiceCredentials: () => true,
    getServiceToken: jest.fn(async () => 'service-token'),
  } as unknown as OpenChoreoTokenService;
  const retriever = createOpenChoreoAlertingFactRetriever(
    tokenService,
    options,
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
    posts: observers.posts(),
    clients: observers.clients,
  };
}

describe('openchoreoAlertingFactRetriever', () => {
  beforeEach(() => jest.clearAllMocks());

  it("reports a component's alert rules and one entry per environment its main line is bound to", async () => {
    const { byName } = await run([mainLine], fakeClient());
    expect(byName.api).toStrictEqual({
      openchoreoAlertingResolved: true,
      openchoreoConfiguredAlertRuleCount: 2,
      openchoreoEnvironmentAlerts: [
        {
          environment: 'dev',
          isProduction: false,
          hasObservability: true,
          ...COUNTS,
        },
        {
          environment: 'prod',
          isProduction: true,
          hasObservability: true,
          ...COUNTS,
        },
      ],
      openchoreoAlertCountsResolved: true,
    });
  });

  it("queries a component's main line without naming a line", async () => {
    const { posts } = await run([mainLine], fakeClient());
    expect(posts).toHaveLength(4);
    for (const { options } of posts) {
      expect(options.body.searchScope).toStrictEqual({
        namespace: 'acme',
        project: 'payments',
        component: 'api',
        environment: expect.any(String),
      });
      expect(options.body.limit).toBe(1000);
    }
  });

  it("scores a release line on its own bindings, scope and added traits, sharing the component's reads", async () => {
    const client = fakeClient();
    const { byName, posts } = await run([mainLine, releaseLine], client);
    expect(byName['api-experimental']).toStrictEqual({
      openchoreoAlertingResolved: true,
      openchoreoConfiguredAlertRuleCount: 3,
      openchoreoEnvironmentAlerts: [
        {
          environment: 'dev',
          isProduction: false,
          hasObservability: true,
          ...COUNTS,
        },
      ],
      openchoreoAlertCountsResolved: true,
    });
    const linePosts = posts.filter(
      ({ options }) => options.body.searchScope.releaseLine,
    );
    expect(linePosts.map(({ options }) => options.body.searchScope)).toEqual([
      {
        namespace: 'acme',
        project: 'payments',
        component: 'api',
        environment: 'dev',
        releaseLine: 'experimental',
      },
      {
        namespace: 'acme',
        project: 'payments',
        component: 'api',
        environment: 'dev',
        releaseLine: 'experimental',
      },
    ]);
    for (const { options } of posts) {
      expect(options.body.searchScope).not.toHaveProperty('allReleaseLines');
    }
    const calls = (path: string) =>
      client.GET.mock.calls.filter(([p]) => p === path).length;
    expect(calls(PATHS.component)).toBe(1);
    expect(calls(PATHS.bindings)).toBe(1);
    expect(calls(PATHS.componentType)).toBe(1);
    expect(calls(PATHS.trait)).toBe(2);
    expect(calls(PATHS.clusterTrait)).toBe(1);
  });

  it('reports only that the component is unresolved when it no longer exists', async () => {
    const { byName, posts } = await run(
      [mainLine, releaseLine],
      fakeClient({ [PATHS.component]: () => status(404) }),
    );
    expect(byName.api).toStrictEqual({ openchoreoAlertingResolved: false });
    expect(byName['api-experimental']).toStrictEqual({
      openchoreoAlertingResolved: false,
    });
    expect(posts).toHaveLength(0);
  });

  it('reports a release line that no longer exists as unresolved', async () => {
    const { byName } = await run(
      [releaseLine],
      fakeClient({ [PATHS.releaseLine]: () => status(404) }),
    );
    expect(byName['api-experimental']).toStrictEqual({
      openchoreoAlertingResolved: false,
    });
  });

  it('skips the entity when the component cannot be read', async () => {
    const { byName, logger } = await run(
      [mainLine],
      fakeClient({ [PATHS.component]: () => status(500) }),
    );
    expect(byName).not.toHaveProperty('api');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('GET component api returned HTTP 500'),
    );
  });

  it('reports nothing for a component OpenChoreo does not manage', async () => {
    const client = fakeClient();
    const { byName } = await run(
      [{ ...mainLine, metadata: { name: 'other', annotations: {} } }],
      client,
    );
    expect(byName).not.toHaveProperty('other');
    expect(client.GET).not.toHaveBeenCalled();
  });

  it('queries one observer for two environments that share it', async () => {
    const { clients, posts } = await run([mainLine], fakeClient());
    expect([...clients.keys()]).toEqual([OBSERVER_A]);
    expect(createObservabilityClientWithUrl).toHaveBeenCalledTimes(1);
    expect(posts.map(({ path }) => path)).toEqual([
      ALERTS,
      INCIDENTS,
      ALERTS,
      INCIDENTS,
    ]);
    expect(
      posts.map(({ options }) => options.body.searchScope.environment),
    ).toEqual(['dev', 'dev', 'prod', 'prod']);
  });

  it("queries each environment's own observer", async () => {
    const { clients, posts } = await run(
      [mainLine],
      fakeClient({
        [PATHS.environment]: ({ path }) =>
          path.envName === 'prod'
            ? ok({
                spec: {
                  isProduction: true,
                  dataPlaneRef: { kind: 'ClusterDataPlane', name: 'shared' },
                },
              })
            : ok({ spec: { isProduction: false } }),
      }),
    );
    expect([...clients.keys()].sort()).toEqual([OBSERVER_A, OBSERVER_B]);
    expect(
      posts
        .filter(({ url }) => url === OBSERVER_B)
        .map(({ options }) => options.body.searchScope.environment),
    ).toEqual(['prod', 'prod']);
  });

  it('creates observer clients with the portal service token', async () => {
    await run([mainLine], fakeClient());
    expect(createObservabilityClientWithUrl).toHaveBeenCalledWith(
      OBSERVER_A,
      'service-token',
      expect.anything(),
    );
  });

  it('reports no observability, and no counts, when neither default observability plane exists', async () => {
    const { byName, posts } = await run(
      [mainLine],
      fakeClient({
        [PATHS.observabilityPlane]: () => status(404),
        [PATHS.clusterObservabilityPlane]: () => status(404),
      }),
    );
    expect(byName.api.openchoreoEnvironmentAlerts).toStrictEqual([
      { environment: 'dev', isProduction: false, hasObservability: false },
      { environment: 'prod', isProduction: true, hasObservability: false },
    ]);
    expect(byName.api).not.toHaveProperty('openchoreoAlertCountsResolved');
    expect(posts).toHaveLength(0);
  });

  it("falls back to the cluster's default observability plane when the namespace has none", async () => {
    const client = fakeClient({
      [PATHS.observabilityPlane]: () => status(404),
    });
    const { byName, clients } = await run([mainLine], client);
    expect(byName.api.openchoreoEnvironmentAlerts).toContainEqual({
      environment: 'prod',
      isProduction: true,
      hasObservability: true,
      ...COUNTS,
    });
    expect([...clients.keys()]).toEqual([OBSERVER_B]);
    expect(client.GET).toHaveBeenCalledWith(PATHS.clusterObservabilityPlane, {
      params: { path: { clusterObservabilityPlaneName: 'default' } },
      signal: expect.any(AbortSignal),
    });
  });

  it('reports no observability when neither default data plane exists', async () => {
    const { byName } = await run(
      [mainLine],
      fakeClient({
        [PATHS.dataPlane]: () => status(404),
        [PATHS.clusterDataPlane]: () => status(404),
      }),
    );
    expect(byName.api.openchoreoEnvironmentAlerts).toStrictEqual([
      { environment: 'dev', isProduction: false, hasObservability: false },
      { environment: 'prod', isProduction: true, hasObservability: false },
    ]);
    expect(byName.api).not.toHaveProperty('openchoreoAlertCountsResolved');
  });

  it("falls back to the cluster's default data plane, and from it only to the cluster's default observability plane", async () => {
    const client = fakeClient({ [PATHS.dataPlane]: () => status(404) });
    const { byName, clients } = await run([mainLine], client);
    expect(byName.api.openchoreoEnvironmentAlerts).toStrictEqual([
      {
        environment: 'dev',
        isProduction: false,
        hasObservability: true,
        ...COUNTS,
      },
      {
        environment: 'prod',
        isProduction: true,
        hasObservability: true,
        ...COUNTS,
      },
    ]);
    expect([...clients.keys()]).toEqual([OBSERVER_B]);
    expect(client.GET).toHaveBeenCalledWith(PATHS.clusterDataPlane, {
      params: { path: { cdpName: 'default' } },
      signal: expect.any(AbortSignal),
    });
    expect(
      client.GET.mock.calls.filter(([p]) => p === PATHS.observabilityPlane),
    ).toHaveLength(0);
  });

  it("doesn't fall back when the environment names its data plane", async () => {
    const client = fakeClient({
      [PATHS.environment]: () =>
        ok({ spec: { dataPlaneRef: { kind: 'DataPlane', name: 'edge' } } }),
      [PATHS.dataPlane]: () => status(404),
    });
    const { byName } = await run([mainLine], client);
    expect(byName.api.openchoreoEnvironmentAlerts).toStrictEqual([
      { environment: 'dev', isProduction: false, hasObservability: false },
      { environment: 'prod', isProduction: false, hasObservability: false },
    ]);
    expect(
      client.GET.mock.calls.filter(([p]) => p === PATHS.clusterDataPlane),
    ).toHaveLength(0);
  });

  it("doesn't fall back when the data plane names its observability plane", async () => {
    const client = fakeClient({
      [PATHS.dataPlane]: () =>
        ok({
          spec: {
            observabilityPlaneRef: { kind: 'ObservabilityPlane', name: 'obs' },
          },
        }),
      [PATHS.observabilityPlane]: () => status(404),
    });
    const { byName } = await run([mainLine], client);
    expect(byName.api.openchoreoEnvironmentAlerts).toStrictEqual([
      { environment: 'dev', isProduction: false, hasObservability: false },
      { environment: 'prod', isProduction: true, hasObservability: false },
    ]);
    expect(
      client.GET.mock.calls.filter(
        ([p]) => p === PATHS.clusterObservabilityPlane,
      ),
    ).toHaveLength(0);
  });

  it('retries a failed read for the next entity', async () => {
    let devReads = 0;
    const client = fakeClient({
      [PATHS.environment]: ({ path }) => {
        if (path.envName === 'dev' && devReads++ === 0) {
          return status(500);
        }
        return ok({ spec: { isProduction: path.envName === 'prod' } });
      },
    });
    const { byName } = await run([mainLine, releaseLine], client);
    expect(byName.api.openchoreoEnvironmentAlerts).toContainEqual({
      environment: 'dev',
    });
    expect(byName.api).not.toHaveProperty('openchoreoAlertCountsResolved');
    expect(byName['api-experimental'].openchoreoEnvironmentAlerts).toEqual([
      {
        environment: 'dev',
        isProduction: false,
        hasObservability: true,
        ...COUNTS,
      },
    ]);
    expect(byName['api-experimental'].openchoreoAlertCountsResolved).toBe(true);
    expect(devReads).toBe(2);
  });

  it("leaves observability out when a plane can't be read", async () => {
    const { byName, logger } = await run(
      [mainLine],
      fakeClient({ [PATHS.dataPlane]: () => status(503) }),
    );
    expect(byName.api.openchoreoEnvironmentAlerts).toStrictEqual([
      { environment: 'dev', isProduction: false },
      { environment: 'prod', isProduction: true },
    ]);
    expect(byName.api).not.toHaveProperty('openchoreoAlertCountsResolved');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('GET DataPlane default returned HTTP 503'),
    );
  });

  it("leaves counts out when the observer rejects the service token, warning once per run that it's the token", async () => {
    const { byName, logger } = await run(
      [mainLine, releaseLine],
      fakeClient(),
      fakeObservers(() => status(401)),
    );
    expect(byName.api.openchoreoEnvironmentAlerts).toStrictEqual([
      { environment: 'dev', isProduction: false, hasObservability: true },
      { environment: 'prod', isProduction: true, hasObservability: true },
    ]);
    expect(byName.api).not.toHaveProperty('openchoreoAlertCountsResolved');
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("didn't accept the portal's service token"),
    );
    expect(logger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('alerts:view'),
    );
  });

  it('leaves counts out when the observer refuses, warning once per run', async () => {
    const { byName, logger } = await run(
      [mainLine, releaseLine],
      fakeClient(),
      fakeObservers(() => status(403)),
    );
    expect(byName.api.openchoreoEnvironmentAlerts).toStrictEqual([
      { environment: 'dev', isProduction: false, hasObservability: true },
      { environment: 'prod', isProduction: true, hasObservability: true },
    ]);
    expect(byName.api).not.toHaveProperty('openchoreoAlertCountsResolved');
    expect(byName['api-experimental'].openchoreoEnvironmentAlerts).toEqual([
      { environment: 'dev', isProduction: false, hasObservability: true },
    ]);
    expect(byName.api.openchoreoConfiguredAlertRuleCount).toBe(2);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('alerts:view and incidents:view'),
    );
  });

  it("keeps one query's counts when the other is refused", async () => {
    const { byName } = await run(
      [mainLine],
      fakeClient(),
      fakeObservers(path =>
        path === ALERTS ? status(403) : ok(incidentsResponse),
      ),
    );
    expect(byName.api.openchoreoEnvironmentAlerts).toContainEqual({
      environment: 'prod',
      isProduction: true,
      hasObservability: true,
      incidentsLast30Days: 3,
      openIncidentsLast30Days: 2,
      unacknowledgedIncidentsLast30Days: 1,
    });
    expect(byName.api).not.toHaveProperty('openchoreoAlertCountsResolved');
  });

  it('leaves out that the counts are resolved when one environment misses them and another has them', async () => {
    const { byName } = await run(
      [mainLine],
      fakeClient(),
      fakeObservers((path, body) => {
        if (body.searchScope.environment === 'prod') {
          return status(500);
        }
        return ok(path === ALERTS ? alertsResponse : incidentsResponse);
      }),
    );
    expect(byName.api.openchoreoEnvironmentAlerts).toStrictEqual([
      {
        environment: 'dev',
        isProduction: false,
        hasObservability: true,
        ...COUNTS,
      },
      { environment: 'prod', isProduction: true, hasObservability: true },
    ]);
    expect(byName.api).not.toHaveProperty('openchoreoAlertCountsResolved');
  });

  it("leaves counts out without a warning when the observer doesn't know the scope yet", async () => {
    const { byName, logger } = await run(
      [mainLine],
      fakeClient(),
      fakeObservers(() =>
        status(400, { title: 'badRequest', errorCode: 'SCOPE_NOT_FOUND' }),
      ),
    );
    expect(byName.api.openchoreoEnvironmentAlerts).toStrictEqual([
      { environment: 'dev', isProduction: false, hasObservability: true },
      { environment: 'prod', isProduction: true, hasObservability: true },
    ]);
    expect(byName.api).not.toHaveProperty('openchoreoAlertCountsResolved');
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalled();
  });

  it('leaves counts out when the observer fails, warning once per observer per run and still querying it', async () => {
    const { byName, logger, posts } = await run(
      [mainLine, releaseLine],
      fakeClient(),
      fakeObservers(() => status(500)),
    );
    expect(byName.api.openchoreoEnvironmentAlerts).toStrictEqual([
      { environment: 'dev', isProduction: false, hasObservability: true },
      { environment: 'prod', isProduction: true, hasObservability: true },
    ]);
    expect(byName.api).not.toHaveProperty('openchoreoAlertCountsResolved');
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(OBSERVER_A),
    );
    expect(posts).toHaveLength(6);
  });

  it("leaves counts out when the observer can't be reached, and doesn't query it again this run", async () => {
    const { byName, logger, posts } = await run(
      [mainLine, releaseLine],
      fakeClient(),
      fakeObservers(() => {
        throw new Error('connect ECONNREFUSED');
      }),
    );
    expect(byName.api.openchoreoEnvironmentAlerts).toStrictEqual([
      { environment: 'dev', isProduction: false, hasObservability: true },
      { environment: 'prod', isProduction: true, hasObservability: true },
    ]);
    expect(byName.api).not.toHaveProperty('openchoreoAlertCountsResolved');
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('ECONNREFUSED'),
    );
    expect(posts).toHaveLength(1);
  });

  it("leaves counts out when the observer times out, keeping the entity's other facts and skipping that observer for the run", async () => {
    const { byName, logger, posts } = await run(
      [mainLine, releaseLine],
      fakeClient(),
      fakeObservers(hang),
      { observerQueryTimeoutMs: 20 },
    );
    expect(byName.api).toStrictEqual({
      openchoreoAlertingResolved: true,
      openchoreoConfiguredAlertRuleCount: 2,
      openchoreoEnvironmentAlerts: [
        { environment: 'dev', isProduction: false, hasObservability: true },
        { environment: 'prod', isProduction: true, hasObservability: true },
      ],
    });
    expect(byName['api-experimental']).toStrictEqual({
      openchoreoAlertingResolved: true,
      openchoreoConfiguredAlertRuleCount: 3,
      openchoreoEnvironmentAlerts: [
        { environment: 'dev', isProduction: false, hasObservability: true },
      ],
    });
    expect(posts).toHaveLength(1);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        `observer ${OBSERVER_A} can't provide: the alerts query for acme/api in dev failed`,
      ),
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('skipped until the next run'),
    );
  });

  it('keeps querying other observers when one times out', async () => {
    const { byName, posts } = await run(
      [mainLine],
      fakeClient({
        [PATHS.environment]: ({ path }) =>
          path.envName === 'prod'
            ? ok({
                spec: {
                  isProduction: true,
                  dataPlaneRef: { kind: 'ClusterDataPlane', name: 'shared' },
                },
              })
            : ok({ spec: { isProduction: false } }),
      }),
      fakeObservers((path, body, request) =>
        request.url === OBSERVER_A
          ? hang(path, body, request)
          : answer(path, body, request),
      ),
      { observerQueryTimeoutMs: 20 },
    );
    expect(byName.api.openchoreoEnvironmentAlerts).toStrictEqual([
      { environment: 'dev', isProduction: false, hasObservability: true },
      {
        environment: 'prod',
        isProduction: true,
        hasObservability: true,
        ...COUNTS,
      },
    ]);
    expect(posts.map(({ url, path }) => [url, path])).toEqual([
      [OBSERVER_A, ALERTS],
      [OBSERVER_B, ALERTS],
      [OBSERVER_B, INCIDENTS],
    ]);
  });

  it("doesn't skip the observer for the run when the entity's deadline cuts its query short", async () => {
    let calls = 0;
    let hungSignal: AbortSignal | undefined;
    const { byName, posts } = await run(
      [mainLine, releaseLine],
      fakeClient(),
      fakeObservers((path, body, request) => {
        if (++calls === 1) {
          hungSignal = request.signal;
          return hang(path, body, request);
        }
        return answer(path, body, request);
      }),
      { observerQueryTimeoutMs: 5_000, deadlineMs: 50 },
    );
    expect(byName).not.toHaveProperty('api');
    expect(hungSignal?.aborted).toBe(true);
    expect(byName['api-experimental'].openchoreoEnvironmentAlerts).toEqual([
      {
        environment: 'dev',
        isProduction: false,
        hasObservability: true,
        ...COUNTS,
      },
    ]);
    expect(posts).toHaveLength(3);
  });

  it('leaves the critical count out when the observer returns fewer alerts than it counts', async () => {
    const { byName } = await run(
      [mainLine],
      fakeClient(),
      fakeObservers(path =>
        path === ALERTS
          ? ok({ ...alertsResponse, total: 1200 })
          : ok(incidentsResponse),
      ),
    );
    const [dev] = byName.api.openchoreoEnvironmentAlerts as any[];
    expect(dev.alertsFiredLast30Days).toBe(1200);
    expect(dev).not.toHaveProperty('criticalAlertsLast30Days');
    expect(byName.api).not.toHaveProperty('openchoreoAlertCountsResolved');
  });

  it("passes the entity's signal to every request", async () => {
    const client = fakeClient();
    const { posts } = await run([mainLine, releaseLine], client);
    for (const [, options] of client.GET.mock.calls) {
      expect(options.signal).toBeInstanceOf(AbortSignal);
    }
    for (const { options } of posts) {
      expect(options.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it('queries the trailing 30 days ending at run time', async () => {
    const before = Date.now();
    const { posts } = await run([mainLine], fakeClient());
    for (const { options } of posts) {
      const start = Date.parse(options.body.startTime);
      const end = Date.parse(options.body.endTime);
      expect(end - start).toBe(THIRTY_DAYS_MS);
      expect(end).toBeGreaterThan(before - 1000);
      expect(end).toBeLessThanOrEqual(Date.now());
    }
  });

  it('leaves the environment list out for a line with no active binding', async () => {
    const { byName, posts } = await run(
      [mainLine],
      fakeClient({
        [PATHS.bindings]: () =>
          ok({ items: [binding('dev', undefined, 'Undeploy')] }),
      }),
    );
    expect(byName.api).toStrictEqual({
      openchoreoAlertingResolved: true,
      openchoreoConfiguredAlertRuleCount: 2,
    });
    expect(posts).toHaveLength(0);
  });

  it("reads the namespace's authz profile once per run", async () => {
    const client = fakeClient();
    await run([mainLine, releaseLine], client);
    expect(client.GET).toHaveBeenCalledWith(PATHS.profile, {
      params: { query: { namespace: 'acme' } },
      signal: expect.any(AbortSignal),
    });
    expect(
      client.GET.mock.calls.filter(([p]) => p === PATHS.profile),
    ).toHaveLength(1);
  });

  it('reports the environment list when authorization is turned off', async () => {
    const { byName } = await run(
      [mainLine],
      fakeClient({
        [PATHS.profile]: () =>
          ok({ capabilities: { '*': { allowed: [{ path: '*' }] } } }),
      }),
    );
    expect(byName.api.openchoreoEnvironmentAlerts).toHaveLength(2);
  });

  it('leaves the environment list out when a CEL condition limits which bindings can be seen', async () => {
    const client = fakeClient({
      [PATHS.profile]: () =>
        ok({
          capabilities: {
            ...allBindings,
            'releasebinding:view': {
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
        }),
    });
    const { byName, posts } = await run([mainLine], client);
    expect(byName.api).toStrictEqual({
      openchoreoAlertingResolved: true,
      openchoreoConfiguredAlertRuleCount: 2,
    });
    expect(
      client.GET.mock.calls.filter(([p]) => p === PATHS.bindings),
    ).toHaveLength(0);
    expect(posts).toHaveLength(0);
  });

  it("reports the environment list when releasebinding:view is granted on the component's own path", async () => {
    const client = fakeClient({
      [PATHS.profile]: () =>
        ok({
          capabilities: {
            ...allBindings,
            'releasebinding:view': {
              allowed: [{ path: 'ns/acme/project/payments/component/api' }],
            },
          },
        }),
    });
    const { byName } = await run([mainLine], client);
    expect(byName.api.openchoreoEnvironmentAlerts).toHaveLength(2);
  });

  it("leaves the environment list out when releasebinding:view covers only another component's path", async () => {
    const client = fakeClient({
      [PATHS.profile]: () =>
        ok({
          capabilities: {
            ...allBindings,
            'releasebinding:view': {
              allowed: [{ path: 'ns/acme/project/payments/component/web' }],
            },
          },
        }),
    });
    const { byName } = await run([mainLine], client);
    expect(byName.api).toStrictEqual({
      openchoreoAlertingResolved: true,
      openchoreoConfiguredAlertRuleCount: 2,
    });
    expect(
      client.GET.mock.calls.filter(([p]) => p === PATHS.bindings),
    ).toHaveLength(0);
  });

  it('leaves the environment list out without environment:view on the namespace', async () => {
    const { byName } = await run(
      [mainLine],
      fakeClient({
        [PATHS.profile]: () =>
          ok({
            capabilities: {
              'releasebinding:view': allBindings['releasebinding:view'],
            },
          }),
      }),
    );
    expect(byName.api).toStrictEqual({
      openchoreoAlertingResolved: true,
      openchoreoConfiguredAlertRuleCount: 2,
    });
  });

  it('leaves the environment list out with a warning when the profile fails, and retries it for the next entity', async () => {
    let calls = 0;
    const client = fakeClient({
      [PATHS.profile]: () => {
        calls += 1;
        return calls === 1 ? status(503) : ok({ capabilities: allBindings });
      },
    });
    const { byName, logger } = await run([mainLine, releaseLine], client);
    expect(byName.api).toStrictEqual({
      openchoreoAlertingResolved: true,
      openchoreoConfiguredAlertRuleCount: 2,
    });
    expect(byName['api-experimental']).toHaveProperty(
      'openchoreoEnvironmentAlerts',
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Leaving out openchoreoEnvironmentAlerts for api',
      ),
    );
    expect(calls).toBe(2);
  });

  it("reports an environment that doesn't exist as neither production nor observed", async () => {
    const { byName, posts } = await run(
      [mainLine],
      fakeClient({
        [PATHS.environment]: ({ path }) =>
          path.envName === 'prod'
            ? status(404)
            : ok({ spec: { isProduction: false } }),
      }),
    );
    expect(byName.api.openchoreoEnvironmentAlerts).toContainEqual({
      environment: 'prod',
      isProduction: false,
      hasObservability: false,
    });
    expect(
      posts.filter(
        ({ options }) => options.body.searchScope.environment === 'prod',
      ),
    ).toHaveLength(0);
  });

  it('reports the counts as resolved when an environment without observability sits beside one with all its counts', async () => {
    const { byName } = await run(
      [mainLine],
      fakeClient({
        [PATHS.environment]: ({ path }) =>
          path.envName === 'prod'
            ? status(404)
            : ok({ spec: { isProduction: false } }),
      }),
    );
    expect(byName.api.openchoreoEnvironmentAlerts).toStrictEqual([
      {
        environment: 'dev',
        isProduction: false,
        hasObservability: true,
        ...COUNTS,
      },
      { environment: 'prod', isProduction: false, hasObservability: false },
    ]);
    expect(byName.api.openchoreoAlertCountsResolved).toBe(true);
  });

  it("leaves the environment list out when the bindings can't be read", async () => {
    const { byName, logger } = await run(
      [mainLine],
      fakeClient({ [PATHS.bindings]: () => status(500) }),
    );
    expect(byName.api).toStrictEqual({
      openchoreoAlertingResolved: true,
      openchoreoConfiguredAlertRuleCount: 2,
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Leaving out openchoreoEnvironmentAlerts'),
    );
  });

  it("doesn't count a trait that doesn't exist", async () => {
    const { byName } = await run(
      [mainLine],
      fakeClient({ [PATHS.clusterTrait]: () => status(404) }),
    );
    expect(byName.api.openchoreoConfiguredAlertRuleCount).toBe(1);
  });

  it("leaves the rule count out when a trait can't be read", async () => {
    const { byName, logger } = await run(
      [mainLine],
      fakeClient({ [PATHS.clusterTrait]: () => status(500) }),
    );
    expect(byName.api).not.toHaveProperty('openchoreoConfiguredAlertRuleCount');
    expect(byName.api.openchoreoEnvironmentAlerts).toHaveLength(2);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'GET ClusterTrait default-alerts returned HTTP 500',
      ),
    );
  });

  it('counts only Component traits when the component type no longer exists', async () => {
    const { byName } = await run(
      [mainLine],
      fakeClient({ [PATHS.componentType]: () => status(404) }),
    );
    expect(byName.api.openchoreoConfiguredAlertRuleCount).toBe(1);
  });

  it('reads a ClusterComponentType and defaults its embedded traits to ClusterTrait', async () => {
    const client = fakeClient({
      [PATHS.component]: () =>
        ok({
          spec: {
            owner: { projectName: 'payments' },
            componentType: {
              kind: 'ClusterComponentType',
              name: 'deployment/service',
            },
          },
        }),
      '/api/v1/clustercomponenttypes/{cctName}': ({ path }) =>
        path.cctName === 'service'
          ? ok({ spec: { traits: [{ name: 'default-alerts' }] } })
          : status(404),
    });
    const { byName } = await run([mainLine], client);
    expect(byName.api.openchoreoConfiguredAlertRuleCount).toBe(1);
    expect(client.GET).toHaveBeenCalledWith(PATHS.clusterTrait, {
      params: { path: { clusterTraitName: 'default-alerts' } },
      signal: expect.any(AbortSignal),
    });
  });
});
