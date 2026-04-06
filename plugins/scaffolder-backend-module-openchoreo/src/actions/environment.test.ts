import { createEnvironmentAction } from './environment';

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

jest.mock('@openchoreo/backstage-plugin-catalog-backend-module', () => ({
  translateEnvironmentToEntity: jest.fn(
    (data: any, _ns: string, opts: any) => ({
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Environment',
      metadata: { name: data.name, namespace: _ns },
      spec: { owner: opts.defaultOwner },
    }),
  ),
}));

const buildConfig = (overrides: any = {}) => {
  const {
    baseUrl = 'http://test',
    authzEnabled = false,
    defaultOwner = 'owners',
  } = overrides;
  return {
    getString: (k: string) => (k === 'openchoreo.baseUrl' ? baseUrl : ''),
    getOptionalBoolean: (k: string) =>
      k === 'openchoreo.features.auth.enabled' ? authzEnabled : undefined,
    getOptionalString: (k: string) =>
      k === 'openchoreo.defaultOwner' ? defaultOwner : undefined,
  } as any;
};

const buildCtx = (overrides: any = {}) => ({
  input: {
    namespaceName: 'domain:default/my-ns',
    environmentName: 'dev',
    displayName: 'Development',
    description: 'Dev environment',
    dataPlaneRef: 'dataplane:my-ns/default-dp',
    isProduction: false,
    ...overrides.input,
  },
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
  output: jest.fn(),
  secrets: overrides.secrets,
});

const successResponse = (name = 'dev') => ({
  data: { metadata: { name, annotations: {} } },
  error: undefined,
  response: { ok: true, status: 200 } as any,
});

describe('createEnvironmentAction', () => {
  let mockCatalog: { insertEntity: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCatalog = { insertEntity: jest.fn().mockResolvedValue(undefined) };
  });

  it('creates an environment and emits outputs', async () => {
    mockPOST.mockResolvedValueOnce(successResponse());
    const action = createEnvironmentAction(buildConfig(), mockCatalog as any);
    const ctx = buildCtx();
    await action.handler(ctx as any);

    expect(mockPOST).toHaveBeenCalledWith(
      '/api/v1/namespaces/{namespaceName}/environments',
      expect.anything(),
    );
    expect(ctx.output).toHaveBeenCalledWith('environmentName', 'dev');
    expect(ctx.output).toHaveBeenCalledWith('namespaceName', 'my-ns');
  });

  it('detects ClusterDataPlane kind from entity ref prefix', async () => {
    mockPOST.mockResolvedValueOnce(successResponse());
    const action = createEnvironmentAction(buildConfig(), mockCatalog as any);
    const ctx = buildCtx({
      input: { dataPlaneRef: 'clusterdataplane:openchoreo-cluster/cluster-dp' },
    });
    await action.handler(ctx as any);

    const body = mockPOST.mock.calls[0][1].body;
    expect(body.spec.dataPlaneRef.kind).toBe('ClusterDataPlane');
    expect(body.spec.dataPlaneRef.name).toBe('cluster-dp');
  });

  it('throws on API error', async () => {
    mockPOST.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'boom' },
      response: { ok: false, status: 500 } as any,
    });
    const action = createEnvironmentAction(buildConfig(), mockCatalog as any);
    await expect(action.handler(buildCtx() as any)).rejects.toThrow();
  });

  it('inserts into catalog', async () => {
    mockPOST.mockResolvedValueOnce(successResponse());
    const action = createEnvironmentAction(buildConfig(), mockCatalog as any);
    await action.handler(buildCtx() as any);
    expect(mockCatalog.insertEntity).toHaveBeenCalledTimes(1);
    expect(mockCatalog.insertEntity.mock.calls[0][0].kind).toBe('Environment');
  });

  it('continues when catalog insert fails', async () => {
    mockPOST.mockResolvedValueOnce(successResponse());
    mockCatalog.insertEntity.mockRejectedValueOnce(new Error('fail'));
    const action = createEnvironmentAction(buildConfig(), mockCatalog as any);
    const ctx = buildCtx();
    await action.handler(ctx as any);
    expect(ctx.output).toHaveBeenCalledWith('environmentName', 'dev');
  });

  it('throws when authz enabled and no token', async () => {
    const action = createEnvironmentAction(
      buildConfig({ authzEnabled: true }),
      mockCatalog as any,
    );
    await expect(action.handler(buildCtx() as any)).rejects.toThrow(
      /User authentication token not available/,
    );
  });
});
