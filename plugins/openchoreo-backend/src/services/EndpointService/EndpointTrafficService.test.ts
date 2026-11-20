import { mockServices } from '@backstage/backend-test-utils';
import { createErrorResponse, createOkResponse } from '@openchoreo/test-utils';
import { NotAllowedError } from '@backstage/errors';
import { EndpointTrafficService } from './EndpointTrafficService';

const mockGET = jest.fn();
const mockPOST = jest.fn();
const mockPUT = jest.fn();

jest.mock('@openchoreo/openchoreo-client-node', () => ({
  ...jest.requireActual('@openchoreo/openchoreo-client-node'),
  createOpenChoreoApiClient: jest.fn(() => ({
    GET: mockGET,
    POST: mockPOST,
    PUT: mockPUT,
  })),
  fetchAllPages: jest.fn((fetchPage: (cursor?: string) => Promise<any>) =>
    fetchPage(undefined).then((page: any) => page.items),
  ),
}));

const NS = '/api/v1/namespaces/{namespaceName}';
const ENDPOINT = `${NS}/endpoints/{endpointName}`;
const BINDINGS = `${NS}/endpointreleasebindings`;
const RELEASE = `${NS}/endpointreleases/{endpointReleaseName}`;
const TYPE = '/api/v1/clusterendpointtypes/{cetName}';

const ref = (name: string, weight: number, extra = {}) => ({
  name,
  kind: 'Component',
  component: { name, endpoint: 'http' },
  weight,
  ...extra,
});

const tripsRefs = () => [
  ref('trips-python', 50),
  ref('trips-stale', 50),
  ref('trips-go', 0, {
    match: { headers: [{ name: 'x-preview', type: 'Exact', value: 'true' }] },
  }),
  ref('trips-shadow', 0, { mirror: { percent: 10 } }),
];

const endpoint = (refs: unknown[] = tripsRefs(), latest = 'trips-7') => ({
  metadata: { name: 'trips', namespace: 'acme' },
  spec: {
    owner: { projectName: 'trips' },
    type: { kind: 'ClusterEndpointType', name: 'http' },
    backendRefs: refs,
  },
  status: { latestRelease: { name: latest } },
});

const binding = (environment: string, backendOverrides?: unknown[]) => ({
  metadata: { name: `trips-${environment}` },
  spec: {
    owner: { projectName: 'trips', endpointName: 'trips' },
    environment,
    endpointRelease: 'trips-7',
    ...(backendOverrides && { backendOverrides }),
  },
});

const list = (items: unknown[]) => createOkResponse({ items, pagination: {} });

function routeGET(routes: Record<string, (opts: any) => unknown>) {
  mockGET.mockImplementation((path: string, opts: any) => {
    const handler = routes[path];
    if (!handler) throw new Error(`unexpected GET ${path}`);
    return Promise.resolve(handler(opts));
  });
}

const ref0 = { namespaceName: 'acme', endpointName: 'trips' };

describe('EndpointTrafficService', () => {
  let service: EndpointTrafficService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EndpointTrafficService(
      mockServices.logger.mock(),
      'http://api',
      0,
      [],
    );
    mockPUT.mockResolvedValue(createOkResponse({}));
    mockPOST.mockResolvedValue(createOkResponse({}));
  });

  describe('fetchTraffic', () => {
    it('reads the default split, the capabilities and each environment', async () => {
      routeGET({
        [ENDPOINT]: () => createOkResponse(endpoint()),
        [BINDINGS]: () =>
          list([
            binding('development', [
              { name: 'trips-python', weight: 45 },
              { name: 'trips-go', weight: 5 },
              { name: 'trips-java', weight: 10 },
            ]),
            binding('staging'),
          ]),
        [RELEASE]: () =>
          createOkResponse({ spec: { backendRefs: tripsRefs() } }),
        [TYPE]: () =>
          createOkResponse({ spec: { capabilities: ['Match', 'Mirror'] } }),
      });

      const info = await service.fetchTraffic('acme', 'trips');

      expect(info.capabilities).toEqual(['Match', 'Mirror']);
      expect(info.backends.map(b => [b.name, b.weight])).toEqual([
        ['trips-python', 50],
        ['trips-stale', 50],
        ['trips-go', 0],
        ['trips-shadow', 0],
      ]);
      expect(info.backends[2].match?.headers?.[0].name).toBe('x-preview');
      expect(info.backends[3].mirror).toEqual({ percent: 10 });
      const [dev, staging] = info.environments;
      expect(dev.overrides).toEqual([
        { name: 'trips-python', weight: 45 },
        { name: 'trips-go', weight: 5 },
      ]);
      expect(dev.release).toHaveLength(4);
      expect(dev.releaseUnknown).toBeUndefined();
      expect(staging.overrides).toEqual([]);
    });

    it('marks a release it couldn’t read as unknown, not empty', async () => {
      routeGET({
        [ENDPOINT]: () => createOkResponse(endpoint()),
        [BINDINGS]: () => list([binding('staging')]),
        [RELEASE]: () => createErrorResponse(500),
        [TYPE]: () => createOkResponse({ spec: {} }),
      });

      const [staging] = (await service.fetchTraffic('acme', 'trips'))
        .environments;

      expect(staging.releaseUnknown).toBe(true);
      expect(staging.release).toEqual([]);
    });
  });

  describe('saveBackend', () => {
    const routes = (refs = tripsRefs(), latest = ['trips-7', 'trips-8']) => {
      let reads = 0;
      routeGET({
        [ENDPOINT]: () =>
          createOkResponse(endpoint(refs, latest[Math.min(reads++, 1)])),
        [BINDINGS]: () => list([]),
      });
    };

    it('adds a backend by weight at 0%', async () => {
      routes();
      const result = await service.saveBackend({
        ...ref0,
        componentName: 'trips-java',
        endpoint: 'http',
        traffic: { kind: 'weight' },
      });

      expect(result).toEqual({
        backendName: 'trips-java',
        latestRelease: 'trips-8',
      });
      const body = mockPUT.mock.calls[0][1].body;
      expect(body.spec.backendRefs[4]).toEqual({
        name: 'trips-java',
        kind: 'Component',
        component: { name: 'trips-java', endpoint: 'http' },
        weight: 0,
      });
    });

    it('adds a backend by condition and as a mirror', async () => {
      routes();
      await service.saveBackend({
        ...ref0,
        componentName: 'trips-beta',
        endpoint: 'http',
        traffic: {
          kind: 'match',
          match: { cookies: [{ name: 'group', value: 'b' }] },
        },
      });
      await service.saveBackend({
        ...ref0,
        componentName: 'trips-copy',
        endpoint: 'http',
        traffic: { kind: 'mirror', percent: 20 },
      });

      const [beta] = mockPUT.mock.calls[0][1].body.spec.backendRefs.slice(-1);
      expect(beta).toMatchObject({
        weight: 0,
        match: { cookies: [{ name: 'group', value: 'b' }] },
      });
      const [copy] = mockPUT.mock.calls[1][1].body.spec.backendRefs.slice(-1);
      expect(copy).toMatchObject({ weight: 0, mirror: { percent: 20 } });
    });

    it('keeps a backend’s share when it gains a condition, and starts a former mirror at 0%', async () => {
      routes();
      await service.saveBackend({
        ...ref0,
        componentName: 'trips-python',
        endpoint: 'http',
        editing: 'trips-python',
        traffic: { kind: 'match', match: { path: { value: '/next' } } },
      });
      await service.saveBackend({
        ...ref0,
        componentName: 'trips-shadow',
        endpoint: 'http',
        editing: 'trips-shadow',
        traffic: { kind: 'weight' },
      });

      const python = mockPUT.mock.calls[0][1].body.spec.backendRefs[0];
      expect(python).toMatchObject({
        name: 'trips-python',
        weight: 50,
        match: { path: { type: 'PathPrefix', value: '/next' } },
      });
      const shadow = mockPUT.mock.calls[1][1].body.spec.backendRefs[3];
      expect(shadow).toEqual({
        name: 'trips-shadow',
        kind: 'Component',
        component: { name: 'trips-shadow', endpoint: 'http' },
        weight: 0,
      });
    });

    it('refuses a condition another backend has, a second route to one workload endpoint, and an unknown backend', async () => {
      routes();
      await expect(
        service.saveBackend({
          ...ref0,
          componentName: 'trips-beta',
          endpoint: 'http',
          traffic: {
            kind: 'match',
            match: { headers: [{ name: 'x-preview', value: 'true' }] },
          },
        }),
      ).rejects.toThrow('trips-go already gets the requests');
      await expect(
        service.saveBackend({
          ...ref0,
          componentName: 'trips-go',
          endpoint: 'http',
          traffic: { kind: 'weight' },
        }),
      ).rejects.toThrow('already routes to trips-go/http as trips-go');
      await expect(
        service.saveBackend({
          ...ref0,
          componentName: 'trips-x',
          endpoint: 'http',
          editing: 'trips-x',
          traffic: { kind: 'weight' },
        }),
      ).rejects.toThrow('has no backend trips-x');
      expect(mockPUT).not.toHaveBeenCalled();
    });

    it('saves the shares in the same update', async () => {
      routes();
      await service.saveBackend({
        ...ref0,
        componentName: 'trips-java',
        endpoint: 'http',
        traffic: { kind: 'weight' },
        split: {
          'trips-python': 40,
          'trips-stale': 40,
          'trips-go': 0,
          'trips-java': 20,
        },
      });
      const refs = mockPUT.mock.calls[0][1].body.spec.backendRefs;
      expect(refs.map((r: any) => [r.name, r.weight])).toEqual([
        ['trips-python', 40],
        ['trips-stale', 40],
        ['trips-go', 0],
        ['trips-shadow', 0],
        ['trips-java', 20],
      ]);
      await expect(
        service.saveBackend({
          ...ref0,
          componentName: 'trips-kotlin',
          endpoint: 'http',
          traffic: { kind: 'weight' },
          split: {
            'trips-python': 90,
            'trips-stale': 50,
            'trips-go': 0,
            'trips-kotlin': 0,
          },
        }),
      ).rejects.toThrow('Total 140%');
    });

    it('refuses a change that leaves no backend with a share', async () => {
      routes([ref('trips-python', 1)]);
      await expect(
        service.saveBackend({
          ...ref0,
          componentName: 'trips-python',
          endpoint: 'http',
          editing: 'trips-python',
          traffic: { kind: 'mirror', percent: 10 },
        }),
      ).rejects.toThrow('At least one backend needs a share');
    });

    it('leaves moving the Endpoint to its project to openchoreo-api', async () => {
      const owned = {
        ...endpoint([ref('trips-python', 1)]),
        metadata: {
          name: 'trips',
          labels: {
            'openchoreo.dev/source-component': 'trips-python',
            'openchoreo.dev/source-endpoint': 'http',
            keep: 'yes',
          },
        },
      };
      routeGET({
        [ENDPOINT]: () => createOkResponse(owned),
        [BINDINGS]: () => list([]),
      });
      await service.saveBackend({
        ...ref0,
        componentName: 'trips-go',
        endpoint: 'http',
        traffic: { kind: 'weight' },
      });
      // The API widens spec.owner; labels and metadata go back as read.
      expect(mockPUT.mock.calls[0][1].body.metadata).toEqual(owned.metadata);
    });
  });

  describe('removeBackend', () => {
    it('removes a backend in one update', async () => {
      routeGET({
        [ENDPOINT]: () => createOkResponse(endpoint()),
        [BINDINGS]: () => list([]),
      });
      await service.removeBackend({ ...ref0, backendName: 'trips-stale' });
      const refs = mockPUT.mock.calls[0][1].body.spec.backendRefs;
      expect(refs.map((r: any) => r.name)).toEqual([
        'trips-python',
        'trips-go',
        'trips-shadow',
      ]);
    });

    it('refuses a removal that leaves no backend with a share, or no backend', async () => {
      routeGET({
        [ENDPOINT]: () =>
          createOkResponse(
            endpoint([ref('trips-python', 1), ref('trips-go', 0)]),
          ),
      });
      await expect(
        service.removeBackend({ ...ref0, backendName: 'trips-python' }),
      ).rejects.toThrow('Removing trips-python leaves no backend with a share');
      routeGET({
        [ENDPOINT]: () => createOkResponse(endpoint([ref('trips-python', 1)])),
      });
      await expect(
        service.removeBackend({ ...ref0, backendName: 'trips-python' }),
      ).rejects.toThrow('needs at least one backend');
      await expect(
        service.removeBackend({ ...ref0, backendName: 'trips-x' }),
      ).rejects.toThrow('has no backend trips-x');
      expect(mockPUT).not.toHaveBeenCalled();
    });
  });

  describe('tidyOverrides', () => {
    const tidy = (releaseRefs: unknown[], overrides: unknown[]) => {
      routeGET({
        [BINDINGS]: () => list([binding('development', overrides)]),
        [RELEASE]: () =>
          createOkResponse({ spec: { backendRefs: releaseRefs } }),
      });
      return service.tidyOverrides('acme', 'trips');
    };

    it('drops the share of a removed backend without moving traffic', async () => {
      await tidy(
        [ref('trips-python', 50), ref('trips-stale', 50)],
        [
          { name: 'trips-python', weight: 45 },
          { name: 'trips-stale', weight: 50 },
          { name: 'trips-go', weight: 5 },
        ],
      );
      expect(mockPUT.mock.calls[0][1].body.spec.backendOverrides).toEqual([
        { name: 'trips-python', weight: 45 },
        { name: 'trips-stale', weight: 50 },
      ]);
    });

    it('keeps the rest when the removed backend had no share', async () => {
      await tidy(
        [ref('trips-stale', 50), ref('trips-go', 0)],
        [
          { name: 'trips-python', weight: 0 },
          { name: 'trips-stale', weight: 50 },
          { name: 'trips-go', weight: 50 },
        ],
      );
      expect(mockPUT.mock.calls[0][1].body.spec.backendOverrides).toEqual([
        { name: 'trips-stale', weight: 50 },
        { name: 'trips-go', weight: 50 },
      ]);
    });

    it('leaves an own split that still applies untouched', async () => {
      await tidy(tripsRefs(), [
        { name: 'trips-python', weight: 45 },
        { name: 'trips-go', weight: 5 },
      ]);
      expect(mockPUT).not.toHaveBeenCalled();
    });

    it('never fails the change it follows', async () => {
      mockGET.mockRejectedValue(new Error('down'));
      await expect(
        service.tidyOverrides('acme', 'trips'),
      ).resolves.toBeUndefined();
    });
  });

  describe('setDefaultSplit', () => {
    it('writes every share and copy in one update', async () => {
      routeGET({ [ENDPOINT]: () => createOkResponse(endpoint()) });
      await service.setDefaultSplit({
        ...ref0,
        split: {
          'trips-python': 40,
          'trips-stale': 50,
          'trips-go': 10,
          'trips-shadow': 25,
        },
      });

      const body = mockPUT.mock.calls[0][1].body;
      expect(
        body.spec.backendRefs.map((r: any) => r.mirror?.percent ?? r.weight),
      ).toEqual([40, 50, 10, 25]);
      expect(body.spec.backendRefs[2].match).toBeDefined();
    });

    it('refuses shares that don’t add up to 100', async () => {
      routeGET({ [ENDPOINT]: () => createOkResponse(endpoint()) });
      await expect(
        service.setDefaultSplit({
          ...ref0,
          split: { 'trips-python': 60, 'trips-stale': 50, 'trips-go': 0 },
        }),
      ).rejects.toThrow('Total 110%. Take 10% off a backend.');
    });

    it('says when the Endpoint changed since it was read', async () => {
      routeGET({ [ENDPOINT]: () => createOkResponse(endpoint()) });
      mockPUT.mockResolvedValue({
        error: { message: 'conflict' },
        response: { ok: false, status: 409 },
      });
      await expect(
        service.setDefaultSplit({
          ...ref0,
          split: { 'trips-python': 50, 'trips-stale': 50, 'trips-go': 0 },
        }),
      ).rejects.toThrow('The Endpoint changed since you opened it');
    });
  });

  describe('setEnvironmentSplit', () => {
    const routes = (overrides?: unknown[]) =>
      routeGET({
        [BINDINGS]: () => list([binding('development', overrides)]),
        [RELEASE]: () =>
          createOkResponse({ spec: { backendRefs: tripsRefs() } }),
      });

    it('stores an own split, keeping the copy the environment has', async () => {
      routes([{ name: 'trips-shadow', mirror: { percent: 30 } }]);
      await service.setEnvironmentSplit({
        ...ref0,
        environment: 'development',
        split: { 'trips-python': 45, 'trips-stale': 50, 'trips-go': 5 },
      });

      const body = mockPUT.mock.calls[0][1].body;
      expect(body.spec.backendOverrides).toEqual([
        { name: 'trips-python', weight: 45 },
        { name: 'trips-stale', weight: 50 },
        { name: 'trips-go', weight: 5 },
        { name: 'trips-shadow', mirror: { percent: 30 } },
      ]);
    });

    it('stores nothing for the release’s own split, and drops it with null', async () => {
      routes([{ name: 'trips-go', weight: 5 }]);
      await service.setEnvironmentSplit({
        ...ref0,
        environment: 'development',
        split: { 'trips-python': 50, 'trips-stale': 50, 'trips-go': 0 },
      });
      await service.setEnvironmentSplit({
        ...ref0,
        environment: 'development',
        split: null,
      });
      expect(mockPUT.mock.calls[0][1].body.spec.backendOverrides).toEqual([]);
      expect(mockPUT.mock.calls[1][1].body.spec.backendOverrides).toEqual([]);
    });

    it('stores the environment’s own condition, and keeps it when only the split changes', async () => {
      routes();
      const beta = { path: { value: '/beta' } };
      await service.setEnvironmentSplit({
        ...ref0,
        environment: 'development',
        split: { 'trips-python': 50, 'trips-stale': 50, 'trips-go': 0 },
        matches: { 'trips-go': beta },
      });
      expect(mockPUT.mock.calls[0][1].body.spec.backendOverrides).toEqual([
        {
          name: 'trips-go',
          match: { path: { type: 'PathPrefix', value: '/beta' } },
        },
      ]);

      routes([
        {
          name: 'trips-go',
          match: { path: { type: 'PathPrefix', value: '/beta' } },
        },
      ]);
      await service.setEnvironmentSplit({
        ...ref0,
        environment: 'development',
        split: { 'trips-python': 45, 'trips-stale': 50, 'trips-go': 5 },
      });
      expect(
        mockPUT.mock.calls[1][1].body.spec.backendOverrides,
      ).toContainEqual({
        name: 'trips-go',
        weight: 5,
        match: { path: { type: 'PathPrefix', value: '/beta' } },
      });
    });

    it('says when the control plane drops an environment’s own condition', async () => {
      routes();
      mockPUT.mockImplementation(async (_path: string, opts: any) =>
        createOkResponse({
          spec: {
            ...opts.body.spec,
            backendOverrides: opts.body.spec.backendOverrides.map(
              ({ match: _m, ...rest }: any) => rest,
            ),
          },
        }),
      );
      await expect(
        service.setEnvironmentSplit({
          ...ref0,
          environment: 'development',
          split: { 'trips-python': 50, 'trips-stale': 50, 'trips-go': 0 },
          matches: {
            'trips-go': {
              path: { value: '/beta' },
              headers: [{ name: 'x-beta', value: 'true' }],
            },
          },
        }),
      ).rejects.toThrow('own conditions yet');
    });

    it('refuses what the release’s type can’t render', async () => {
      routeGET({
        [BINDINGS]: () => list([binding('development')]),
        [RELEASE]: () =>
          createOkResponse({
            spec: {
              backendRefs: tripsRefs(),
              endpointType: {
                kind: 'ClusterEndpointType',
                name: 'gamma-httproute',
                spec: { capabilities: ['Match', 'Mirror', 'MirrorPercent'] },
              },
            },
          }),
      });
      await expect(
        service.setEnvironmentSplit({
          ...ref0,
          environment: 'development',
          split: { 'trips-python': 50, 'trips-stale': 50, 'trips-go': 0 },
          matches: { 'trips-go': { cookies: [{ name: 'group', value: 'b' }] } },
        }),
      ).rejects.toThrow(
        'a cookie condition needs the RegularExpression capability',
      );
      expect(mockPUT).not.toHaveBeenCalled();
    });

    it('refuses a condition for a backend with none, or a bad one', async () => {
      routes();
      const split = { 'trips-python': 50, 'trips-stale': 50, 'trips-go': 0 };
      await expect(
        service.setEnvironmentSplit({
          ...ref0,
          environment: 'development',
          split,
          matches: { 'trips-python': { path: { value: '/beta' } } },
        }),
      ).rejects.toThrow('an environment can change a condition, not add one');
      await expect(
        service.setEnvironmentSplit({
          ...ref0,
          environment: 'development',
          split,
          matches: { 'trips-go': {} },
        }),
      ).rejects.toThrow('trips-go:');
      expect(mockPUT).not.toHaveBeenCalled();
    });

    it('says when the split changed since it was opened', async () => {
      routes();
      mockPUT.mockResolvedValue({
        error: { message: 'conflict' },
        response: { ok: false, status: 409 },
      });
      await expect(
        service.setEnvironmentSplit({
          ...ref0,
          environment: 'development',
          split: null,
        }),
      ).rejects.toThrow('The split changed since you opened it');
    });

    it('needs the Endpoint deployed there', async () => {
      routeGET({ [BINDINGS]: () => list([]) });
      await expect(
        service.setEnvironmentSplit({
          ...ref0,
          environment: 'production',
          split: null,
        }),
      ).rejects.toThrow('is not deployed in production');
    });
  });

  describe('reading a release for a write', () => {
    it('passes on a failure other than a missing release', async () => {
      routeGET({
        [BINDINGS]: () => list([binding('staging')]),
        [RELEASE]: () => createErrorResponse(403),
      });
      const saving = service.setEnvironmentSplit({
        ...ref0,
        environment: 'staging',
        split: { 'trips-python': 100, 'trips-stale': 0, 'trips-go': 0 },
      });
      await expect(saving).rejects.toBeInstanceOf(NotAllowedError);
      await expect(saving).rejects.toThrow('fail');
      expect(mockPUT).not.toHaveBeenCalled();
    });

    it('refuses a condition that isn’t a match, readably', async () => {
      routeGET({
        [BINDINGS]: () => list([binding('staging')]),
        [RELEASE]: () =>
          createOkResponse({ spec: { backendRefs: tripsRefs() } }),
      });
      await expect(
        service.setEnvironmentSplit({
          ...ref0,
          environment: 'staging',
          split: { 'trips-python': 50, 'trips-stale': 50, 'trips-go': 0 },
          matches: { 'trips-go': { headers: [{ value: 'true' }] } as never },
        }),
      ).rejects.toThrow(
        'trips-go: Each header and cookie takes a name and a value',
      );
      expect(mockPUT).not.toHaveBeenCalled();
    });
  });

  describe('saving after the Endpoint is updated', () => {
    it('reports the save when its new release can’t be read', async () => {
      let reads = 0;
      routeGET({
        [ENDPOINT]: () => {
          reads += 1;
          if (reads > 1) throw new Error('connection reset');
          return createOkResponse(endpoint());
        },
      });
      await expect(
        service.setDefaultSplit({
          ...ref0,
          split: {
            'trips-python': 40,
            'trips-stale': 60,
            'trips-go': 0,
            'trips-shadow': 10,
          },
        }),
      ).resolves.toEqual({});
      expect(mockPUT).toHaveBeenCalledTimes(1);
    });
  });

  describe('deployRelease', () => {
    const deploy = (
      releaseRefs: unknown[],
      overrides?: unknown[],
      bindings?: unknown[],
    ) => {
      routeGET({
        [RELEASE]: () =>
          createOkResponse({ spec: { backendRefs: releaseRefs } }),
        [BINDINGS]: () => list(bindings ?? [binding('staging', overrides)]),
      });
      return service.deployRelease({
        ...ref0,
        projectName: 'trips',
        environment: 'staging',
        releaseName: 'trips-8',
      });
    };

    it('keeps an own split the new release still has, dropping ignored entries', async () => {
      await deploy(tripsRefs(), [
        { name: 'trips-python', weight: 40 },
        { name: 'trips-stale', weight: 50 },
        { name: 'trips-go', weight: 10 },
        { name: 'trips-java', weight: 0 },
      ]);
      const spec = mockPUT.mock.calls[0][1].body.spec;
      expect(spec.endpointRelease).toBe('trips-8');
      expect(spec.backendOverrides).toEqual([
        { name: 'trips-python', weight: 40 },
        { name: 'trips-stale', weight: 50 },
        { name: 'trips-go', weight: 10 },
      ]);
    });

    it('drops an own split that equals the new release’s', async () => {
      await deploy(
        [ref('trips-stale', 50), ref('trips-go', 50)],
        [
          { name: 'trips-python', weight: 0 },
          { name: 'trips-stale', weight: 50 },
          { name: 'trips-go', weight: 50 },
        ],
      );
      expect(mockPUT.mock.calls[0][1].body.spec.backendOverrides).toEqual([]);
    });

    it('drops an own split that would route nothing', async () => {
      await deploy(
        [ref('trips-python', 1), ref('trips-go', 1)],
        [
          { name: 'trips-python', weight: 0 },
          { name: 'trips-go', weight: 0 },
        ],
      );
      expect(mockPUT.mock.calls[0][1].body.spec.backendOverrides).toEqual([]);
    });

    it('drops the override of a backend whose name now routes elsewhere', async () => {
      const canary = (component: string) =>
        ref('trips-canary', 0, {
          component: { name: component, endpoint: 'http' },
        });
      routeGET({
        [RELEASE]: (opts: any) =>
          createOkResponse({
            spec: {
              backendRefs: [
                ref('trips-python', 1),
                canary(
                  opts.params.path.endpointReleaseName === 'trips-8'
                    ? 'trips-v3'
                    : 'trips-canary',
                ),
              ],
            },
          }),
        [BINDINGS]: () =>
          list([
            binding('staging', [
              { name: 'trips-python', weight: 10 },
              { name: 'trips-canary', weight: 90 },
            ]),
          ]),
      });
      await service.deployRelease({
        ...ref0,
        projectName: 'trips',
        environment: 'staging',
        releaseName: 'trips-8',
      });
      // The canary's 90% left with its old target, so staging takes the
      // release's split.
      expect(mockPUT.mock.calls[0][1].body.spec.backendOverrides).toEqual([]);
    });

    it('takes the release’s split when a retargeted backend had a share', async () => {
      const canary = (component: string) =>
        ref('trips-canary', 1, {
          component: { name: component, endpoint: 'http' },
        });
      routeGET({
        [RELEASE]: (opts: any) =>
          createOkResponse({
            spec: {
              backendRefs: [
                ref('trips-python', 1),
                ref('trips-stale', 1),
                canary(
                  opts.params.path.endpointReleaseName === 'trips-8'
                    ? 'trips-v3'
                    : 'trips-canary',
                ),
              ],
            },
          }),
        [BINDINGS]: () =>
          list([
            binding('staging', [
              { name: 'trips-python', weight: 10 },
              { name: 'trips-stale', weight: 0 },
              { name: 'trips-canary', weight: 90 },
            ]),
          ]),
      });
      await service.deployRelease({
        ...ref0,
        projectName: 'trips',
        environment: 'staging',
        releaseName: 'trips-8',
      });
      expect(mockPUT.mock.calls[0][1].body.spec.backendOverrides).toEqual([]);
    });

    it('creates the binding where there is none', async () => {
      await deploy(tripsRefs(), undefined, []);
      expect(mockPOST.mock.calls[0][1].body).toEqual({
        metadata: { name: 'trips-staging' },
        spec: {
          owner: { projectName: 'trips', endpointName: 'trips' },
          environment: 'staging',
          endpointRelease: 'trips-8',
        },
      });
    });
  });
});
