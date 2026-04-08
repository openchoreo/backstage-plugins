import { createNamespaceAction } from './namespace';

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
  translateNamespaceToDomainEntity: jest.fn((data, opts) => ({
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Domain',
    metadata: {
      name: data.name,
      annotations: {
        'backstage.io/managed-by-location': `${opts.locationKey}:ns`,
      },
    },
    spec: { owner: opts.defaultOwner },
  })),
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

const buildCtx = (overrides: any = {}) => ({
  input: {
    namespaceName: 'my-ns',
    displayName: 'My Namespace',
    description: 'A test namespace',
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

const successResponse = (name: string = 'my-ns') => ({
  data: {
    metadata: {
      name,
      annotations: {
        'openchoreo.dev/display-name': 'My Namespace',
        'openchoreo.dev/description': 'A test namespace',
      },
      creationTimestamp: '2024-01-01T00:00:00Z',
    },
    status: { phase: 'Active' },
  },
  error: undefined,
  response: { ok: true, status: 200 } as any,
});

describe('createNamespaceAction', () => {
  let mockImmediateCatalog: { insertEntity: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockImmediateCatalog = {
      insertEntity: jest.fn().mockResolvedValue(undefined),
    };
  });

  it('creates a namespace via the API and emits outputs', async () => {
    mockPOST.mockResolvedValueOnce(successResponse('my-ns'));
    const action = createNamespaceAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );
    const ctx = buildCtx();

    await action.handler(ctx as any);

    expect(mockPOST).toHaveBeenCalledWith(
      '/api/v1/namespaces',
      expect.objectContaining({
        body: expect.objectContaining({
          metadata: expect.objectContaining({
            name: 'my-ns',
            annotations: expect.objectContaining({
              'openchoreo.dev/display-name': 'My Namespace',
              'openchoreo.dev/description': 'A test namespace',
            }),
          }),
        }),
      }),
    );
    expect(ctx.output).toHaveBeenCalledWith('namespaceName', 'my-ns');
    expect(ctx.output).toHaveBeenCalledWith(
      'entityRef',
      'domain:default/my-ns',
    );
  });

  it('wraps API errors with "Failed to create namespace" message', async () => {
    mockPOST.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'boom' },
      response: { ok: false, status: 500 } as any,
    });
    const action = createNamespaceAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );
    const ctx = buildCtx();

    await expect(action.handler(ctx as any)).rejects.toThrow(
      /Failed to create namespace/,
    );
    expect(ctx.logger.error).toHaveBeenCalled();
  });

  it('inserts the namespace into the catalog with the right entity shape', async () => {
    mockPOST.mockResolvedValueOnce(successResponse('my-ns'));
    const action = createNamespaceAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );
    const ctx = buildCtx();

    await action.handler(ctx as any);

    expect(mockImmediateCatalog.insertEntity).toHaveBeenCalledTimes(1);
    const inserted = mockImmediateCatalog.insertEntity.mock.calls[0][0];
    expect(inserted.kind).toBe('Domain');
    expect(inserted.metadata.name).toBe('my-ns');
    expect(inserted.spec.owner).toBe('group:default/owners');
  });

  it('continues (does not throw) when catalog insertion fails', async () => {
    mockPOST.mockResolvedValueOnce(successResponse('my-ns'));
    mockImmediateCatalog.insertEntity.mockRejectedValueOnce(
      new Error('catalog down'),
    );
    const action = createNamespaceAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );
    const ctx = buildCtx();

    await action.handler(ctx as any);

    expect(ctx.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to immediately add namespace to catalog'),
    );
    expect(ctx.output).toHaveBeenCalledWith('namespaceName', 'my-ns');
  });

  it('throws when authz is enabled and no user token is provided', async () => {
    const action = createNamespaceAction(
      buildConfig({ authzEnabled: true }),
      mockImmediateCatalog as any,
    );
    const ctx = buildCtx();

    await expect(action.handler(ctx as any)).rejects.toThrow(
      /User authentication token not available/,
    );
    expect(mockPOST).not.toHaveBeenCalled();
  });

  it('proceeds when authz is enabled and a token is supplied via secrets', async () => {
    mockPOST.mockResolvedValueOnce(successResponse('my-ns'));
    const action = createNamespaceAction(
      buildConfig({ authzEnabled: true }),
      mockImmediateCatalog as any,
    );
    const ctx = buildCtx({ secrets: { OPENCHOREO_USER_TOKEN: 'tkn' } });

    await action.handler(ctx as any);

    expect(mockPOST).toHaveBeenCalled();
    expect(ctx.output).toHaveBeenCalledWith('namespaceName', 'my-ns');
  });

  it('omits display-name and description annotations when those inputs are not provided', async () => {
    mockPOST.mockResolvedValueOnce(successResponse('my-ns'));
    const action = createNamespaceAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );
    const ctx = buildCtx({ input: { namespaceName: 'my-ns' } });
    // wipe out optional defaults on the test input
    ctx.input.displayName = undefined;
    ctx.input.description = undefined;

    await action.handler(ctx as any);

    const body = mockPOST.mock.calls[0][1].body;
    expect(
      body.metadata.annotations['openchoreo.dev/display-name'],
    ).toBeUndefined();
    expect(
      body.metadata.annotations['openchoreo.dev/description'],
    ).toBeUndefined();
  });
});
