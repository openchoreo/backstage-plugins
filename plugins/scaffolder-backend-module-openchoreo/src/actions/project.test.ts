import { createProjectAction } from './project';

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
  translateProjectToEntity: jest.fn((data: any, _ns: string, opts: any) => ({
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'System',
    metadata: { name: data.name },
    spec: { owner: opts.defaultOwner },
  })),
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
    projectName: 'my-project',
    displayName: 'My Project',
    description: 'A test project',
    deploymentPipeline: 'default-pipeline',
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

const successResponse = (name = 'my-project') => ({
  data: {
    metadata: {
      name,
      uid: 'uid-1',
      annotations: { 'openchoreo.dev/display-name': 'My Project' },
    },
  },
  error: undefined,
  response: { ok: true, status: 200 } as any,
});

describe('createProjectAction', () => {
  let mockImmediateCatalog: { insertEntity: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockImmediateCatalog = {
      insertEntity: jest.fn().mockResolvedValue(undefined),
    };
  });

  it('creates a project and emits outputs', async () => {
    mockPOST.mockResolvedValueOnce(successResponse());
    const action = createProjectAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );
    const ctx = buildCtx();
    await action.handler(ctx as any);

    expect(mockPOST).toHaveBeenCalledWith(
      '/api/v1/namespaces/{namespaceName}/projects',
      expect.anything(),
    );
    expect(ctx.output).toHaveBeenCalledWith('projectName', 'my-project');
    expect(ctx.output).toHaveBeenCalledWith('namespaceName', 'my-ns');
    expect(ctx.output).toHaveBeenCalledWith(
      'entityRef',
      'system:my-ns/my-project',
    );
  });

  it('extracts namespace from entity ref format', async () => {
    mockPOST.mockResolvedValueOnce(successResponse());
    const action = createProjectAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );
    const ctx = buildCtx({
      input: { namespaceName: 'domain:default/extracted-ns' },
    });
    await action.handler(ctx as any);
    expect(ctx.output).toHaveBeenCalledWith('namespaceName', 'extracted-ns');
  });

  it('throws on API error', async () => {
    mockPOST.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'boom' },
      response: { ok: false, status: 500 } as any,
    });
    const action = createProjectAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );
    await expect(action.handler(buildCtx() as any)).rejects.toThrow();
  });

  it('inserts into catalog with System entity', async () => {
    mockPOST.mockResolvedValueOnce(successResponse());
    const action = createProjectAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );
    await action.handler(buildCtx() as any);
    expect(mockImmediateCatalog.insertEntity).toHaveBeenCalledTimes(1);
    expect(mockImmediateCatalog.insertEntity.mock.calls[0][0].kind).toBe(
      'System',
    );
  });

  it('continues when catalog insert fails', async () => {
    mockPOST.mockResolvedValueOnce(successResponse());
    mockImmediateCatalog.insertEntity.mockRejectedValueOnce(
      new Error('catalog down'),
    );
    const action = createProjectAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );
    const ctx = buildCtx();
    await action.handler(ctx as any);
    expect(ctx.output).toHaveBeenCalledWith('projectName', 'my-project');
  });

  it('throws when authz enabled and no token', async () => {
    const action = createProjectAction(
      buildConfig({ authzEnabled: true }),
      mockImmediateCatalog as any,
    );
    await expect(action.handler(buildCtx() as any)).rejects.toThrow(
      /User authentication token not available/,
    );
  });

  it('proceeds with token when authz enabled', async () => {
    mockPOST.mockResolvedValueOnce(successResponse());
    const action = createProjectAction(
      buildConfig({ authzEnabled: true }),
      mockImmediateCatalog as any,
    );
    await action.handler(
      buildCtx({ secrets: { OPENCHOREO_USER_TOKEN: 'tkn' } }) as any,
    );
    expect(mockPOST).toHaveBeenCalled();
  });
});
