import { createEndpointAction } from './endpoint';

const mockPOST = jest.fn();

jest.mock('@openchoreo/openchoreo-client-node', () => ({
  ...jest.requireActual('@openchoreo/openchoreo-client-node'),
  createOpenChoreoApiClient: jest.fn(() => ({
    POST: mockPOST,
    GET: jest.fn(),
    PUT: jest.fn(),
    DELETE: jest.fn(),
  })),
}));

const mockTranslate = jest.fn();
jest.mock('@openchoreo/backstage-plugin-catalog-backend-module', () => ({
  translateEndpointToEntities: (...args: any[]) => mockTranslate(...args),
}));

const buildConfig = (
  overrides: Partial<{
    baseUrl: string;
    authzEnabled: boolean;
    defaultOwner: string;
  }> = {},
) => {
  const {
    baseUrl = 'http://test',
    authzEnabled = false,
    defaultOwner = 'owners',
  } = overrides;
  return {
    getString: (k: string) => {
      if (k === 'openchoreo.baseUrl') return baseUrl;
      throw new Error(`unexpected getString: ${k}`);
    },
    getOptionalBoolean: (k: string) => {
      if (k === 'openchoreo.features.auth.enabled') return authzEnabled;
      return undefined;
    },
    getOptionalString: (k: string) => {
      if (k === 'openchoreo.defaultOwner') return defaultOwner;
      return undefined;
    },
  } as any;
};

const buildInput = (overrides: Record<string, any> = {}) => ({
  namespaceName: 'acme',
  projectName: 'store',
  endpointName: 'orders-api',
  displayName: 'Orders API',
  typeKind: 'ClusterEndpointType' as const,
  typeName: 'http-route',
  visibility: ['external'],
  backends: [
    { name: 'primary', component: 'orders', endpoint: 'http', weight: 90 },
    { name: 'canary', component: 'orders-v2', endpoint: 'http', weight: 10 },
  ],
  ...overrides,
});

const buildCtx = (input: Record<string, any> = {}) => ({
  input: buildInput(input),
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
  output: jest.fn(),
  secrets: undefined,
});

const created = {
  data: { metadata: { name: 'orders-api', uid: 'ep-uid' } },
  error: undefined,
  response: { ok: true, status: 201 },
};

describe('openchoreo:endpoint:create', () => {
  const immediateCatalog = { insertEntity: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPOST.mockResolvedValue(created);
    mockTranslate.mockReturnValue([{ kind: 'Endpoint' }, { kind: 'API' }]);
  });

  it('creates the Endpoint with Component backend refs', async () => {
    const action = createEndpointAction(buildConfig(), immediateCatalog as any);
    const ctx = buildCtx();
    await action.handler(ctx as any);

    const [path, opts] = mockPOST.mock.calls[0];
    expect(path).toBe('/api/v1/namespaces/{namespaceName}/endpoints');
    expect(opts.params.path).toEqual({ namespaceName: 'acme' });
    expect(opts.body).toEqual({
      metadata: {
        name: 'orders-api',
        annotations: { 'openchoreo.dev/display-name': 'Orders API' },
      },
      spec: {
        owner: { projectName: 'store' },
        type: { kind: 'ClusterEndpointType', name: 'http-route' },
        visibility: ['external'],
        backendRefs: [
          {
            name: 'primary',
            kind: 'Component',
            component: { name: 'orders', endpoint: 'http' },
            weight: 90,
          },
          {
            name: 'canary',
            kind: 'Component',
            component: { name: 'orders-v2', endpoint: 'http' },
            weight: 10,
          },
        ],
      },
    });
    expect(ctx.output).toHaveBeenCalledWith(
      'entityRef',
      'endpoint:acme/orders-api',
    );
  });

  it('sends a schema only when it has content', async () => {
    const action = createEndpointAction(buildConfig(), immediateCatalog as any);

    await action.handler(
      buildCtx({ schema: { type: 'openapi', content: '' } }) as any,
    );
    expect(mockPOST.mock.calls[0][1].body.spec.schema).toBeUndefined();

    await action.handler(
      buildCtx({
        schema: { type: 'openapi', content: 'openapi: 3.0.0' },
      }) as any,
    );
    expect(mockPOST.mock.calls[1][1].body.spec.schema).toEqual({
      type: 'openapi',
      content: 'openapi: 3.0.0',
    });
  });

  it('inserts the Endpoint and its API entity into the catalog', async () => {
    const action = createEndpointAction(buildConfig(), immediateCatalog as any);
    await action.handler(buildCtx() as any);

    expect(mockTranslate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'orders-api',
        uid: 'ep-uid',
        projectName: 'store',
        typeKind: 'ClusterEndpointType',
        backends: [
          expect.objectContaining({ component: 'orders', weight: 90 }),
          expect.objectContaining({ component: 'orders-v2', weight: 10 }),
        ],
      }),
      'acme',
      expect.objectContaining({ defaultOwner: 'group:default/owners' }),
    );
    expect(immediateCatalog.insertEntity).toHaveBeenCalledTimes(2);
  });

  it('still succeeds when the catalog insert fails', async () => {
    immediateCatalog.insertEntity.mockRejectedValueOnce(
      new Error('catalog down'),
    );
    const action = createEndpointAction(buildConfig(), immediateCatalog as any);
    const ctx = buildCtx();

    await action.handler(ctx as any);

    expect(ctx.output).toHaveBeenCalledWith('endpointName', 'orders-api');
  });

  it('requires a user token when auth is enabled', async () => {
    const action = createEndpointAction(
      buildConfig({ authzEnabled: true }),
      immediateCatalog as any,
    );

    await expect(action.handler(buildCtx() as any)).rejects.toThrow(
      /authentication token/,
    );
    expect(mockPOST).not.toHaveBeenCalled();
  });
});
