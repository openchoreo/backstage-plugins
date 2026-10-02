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

describe('createEnvironmentAction — deployment hooks', () => {
  let mockCatalog: { insertEntity: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCatalog = { insertEntity: jest.fn().mockResolvedValue(undefined) };
  });

  const hooks = {
    preDeploy: [
      {
        name: 'image-scan',
        hookRef: { kind: 'ClusterHook', name: 'trivy-image-scan' },
        onFailure: 'Block',
        timeout: '20m',
      },
    ],
    postDeploy: [
      {
        name: 'notify',
        hookRef: { name: 'slack-notify' },
        mode: 'Async',
      },
    ],
  };

  // The gate only sees what reaches spec.hooks, so a binding lost here would
  // silently disable a security scan.
  it('forwards hook bindings in the request body with the CRD defaults filled', async () => {
    mockPOST.mockResolvedValueOnce(successResponse('production'));
    const action = createEnvironmentAction(buildConfig(), mockCatalog as any);
    await action.handler(
      buildCtx({ input: { environmentName: 'production', hooks } }) as any,
    );
    expect(mockPOST.mock.calls[0][1].body.spec.hooks).toEqual({
      preDeploy: [
        {
          name: 'image-scan',
          hookRef: { kind: 'ClusterHook', name: 'trivy-image-scan' },
          mode: 'Sync',
          onFailure: 'Block',
          timeout: '20m',
          retries: 0,
        },
      ],
      postDeploy: [
        {
          name: 'notify',
          hookRef: { kind: 'Hook', name: 'slack-notify' },
          mode: 'Async',
          retries: 0,
        },
      ],
    });
  });

  // The portal form submits its own shape: blank parameters as "" and a
  // form-only hookSpec. Neither may reach the Environment: "" would override
  // the hook's default with an empty value.
  it('drops blank parameters and the form-only hookSpec from what it sends', async () => {
    mockPOST.mockResolvedValueOnce(successResponse('production'));
    const action = createEnvironmentAction(buildConfig(), mockCatalog as any);
    const formHooks = {
      preDeploy: [
        {
          name: 'image-scan',
          hookRef: { kind: 'ClusterHook', name: 'trivy-image-scan' },
          mode: 'Sync',
          parameters: { severity: 'HIGH', message: '' },
          hookSpec: {
            kind: 'ClusterHook',
            name: 'trivy-image-scan',
            parameters: [],
          },
        },
        {
          name: 'smoke',
          hookRef: { name: 'e2e' },
          parameters: { suite: '' },
        },
      ],
    };
    await action.handler(
      buildCtx({
        input: { environmentName: 'production', hooks: formHooks },
      }) as any,
    );
    const sent = mockPOST.mock.calls[0][1].body.spec.hooks.preDeploy;
    expect(sent[0].parameters).toEqual({ severity: 'HIGH' });
    expect(sent[0]).not.toHaveProperty('hookSpec');
    expect(sent[1]).not.toHaveProperty('parameters');
  });

  it('omits the hooks key for an environment without bindings', async () => {
    mockPOST.mockResolvedValueOnce(successResponse());
    const action = createEnvironmentAction(buildConfig(), mockCatalog as any);
    await action.handler(buildCtx() as any);
    expect(mockPOST.mock.calls[0][1].body.spec).not.toHaveProperty('hooks');

    mockPOST.mockResolvedValueOnce(successResponse());
    await action.handler(
      buildCtx({ input: { hooks: { preDeploy: [], postDeploy: [] } } }) as any,
    );
    expect(mockPOST.mock.calls[1][1].body.spec).not.toHaveProperty('hooks');
  });

  it('carries hook bindings into the immediately inserted catalog entity', async () => {
    const { translateEnvironmentToEntity } = jest.requireMock(
      '@openchoreo/backstage-plugin-catalog-backend-module',
    );
    mockPOST.mockResolvedValueOnce(successResponse('production'));
    const action = createEnvironmentAction(buildConfig(), mockCatalog as any);
    await action.handler(
      buildCtx({ input: { environmentName: 'production', hooks } }) as any,
    );
    expect(translateEnvironmentToEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        hooks: expect.objectContaining({
          preDeploy: [expect.objectContaining({ name: 'image-scan' })],
        }),
      }),
      'my-ns',
      expect.anything(),
    );
    expect(mockCatalog.insertEntity).toHaveBeenCalled();
  });

  it('surfaces the webhook message verbatim when the API rejects the environment', async () => {
    const message =
      'spec.hooks.postDeploy[0].onFailure: Invalid value: "Block": Block is only valid for preDeploy hooks; the release is already rendered when a postDeploy hook fails';
    mockPOST.mockResolvedValueOnce({
      data: undefined,
      error: { message },
      response: { ok: false, status: 400 },
    });
    const action = createEnvironmentAction(buildConfig(), mockCatalog as any);
    const ctx = buildCtx({ input: { hooks } });
    await expect(action.handler(ctx as any)).rejects.toThrow(message);
    expect(mockCatalog.insertEntity).not.toHaveBeenCalled();
  });
});
