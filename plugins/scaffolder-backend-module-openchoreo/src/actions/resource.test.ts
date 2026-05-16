import { createResourceAction } from './resource';

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
  translateResourceToEntity: jest.fn((data, ns, cfg) => ({
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Resource',
    metadata: {
      name: data.name,
      namespace: ns,
      annotations: {
        'backstage.io/managed-by-location': `${cfg.locationKey}:res`,
        'openchoreo.io/resource-type': data.typeName,
        'openchoreo.io/resource-type-kind': data.typeKind,
        'openchoreo.io/project': data.projectName,
      },
    },
    spec: {
      type: data.typeName,
      owner: cfg.defaultOwner,
      system: data.projectName,
      ...(data.parameters && { parameters: data.parameters }),
    },
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

const buildInput = (overrides: Record<string, any> = {}) => ({
  namespaceName: 'finance',
  projectName: 'analytics',
  resourceName: 'analytics-db',
  displayName: 'Analytics DB',
  description: 'Primary analytics database',
  typeKind: 'ResourceType' as const,
  typeName: 'postgres',
  parameters: { size: 'small' },
  ...overrides,
});

const buildCtx = (overrides: any = {}) => ({
  input: buildInput(overrides.input),
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
  output: jest.fn(),
  secrets: overrides.secrets,
});

const successResponse = (name = 'analytics-db') => ({
  data: {
    metadata: { name, namespace: 'finance' },
    spec: {
      owner: { projectName: 'analytics' },
      type: { kind: 'ResourceType', name: 'postgres' },
    },
  },
  error: undefined,
  response: { ok: true, status: 200 } as any,
});

describe('createResourceAction', () => {
  let mockImmediateCatalog: { insertEntity: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockImmediateCatalog = {
      insertEntity: jest.fn().mockResolvedValue(undefined),
    };
  });

  it('POSTs to the resources endpoint with a structured body built from the inputs', async () => {
    mockPOST.mockResolvedValueOnce(successResponse());
    const action = createResourceAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );
    await action.handler(buildCtx() as any);

    expect(mockPOST).toHaveBeenCalledTimes(1);
    const [path, opts] = mockPOST.mock.calls[0];
    expect(path).toBe('/api/v1/namespaces/{namespaceName}/resources');
    expect(opts.params.path.namespaceName).toBe('finance');
    expect(opts.body.metadata.name).toBe('analytics-db');
    expect(opts.body.metadata.annotations['openchoreo.dev/display-name']).toBe(
      'Analytics DB',
    );
    expect(opts.body.metadata.annotations['openchoreo.dev/description']).toBe(
      'Primary analytics database',
    );
    expect(opts.body.spec.owner.projectName).toBe('analytics');
    expect(opts.body.spec.type).toEqual({
      kind: 'ResourceType',
      name: 'postgres',
    });
    expect(opts.body.spec.parameters).toEqual({ size: 'small' });
  });

  it('omits annotations when displayName and description are absent', async () => {
    mockPOST.mockResolvedValueOnce(successResponse());
    const action = createResourceAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );
    await action.handler(
      buildCtx({
        input: { displayName: undefined, description: undefined },
      }) as any,
    );

    const [, opts] = mockPOST.mock.calls[0];
    expect(opts.body.metadata.annotations).toBeUndefined();
  });

  it('omits spec.parameters when none provided or when empty', async () => {
    mockPOST.mockResolvedValueOnce(successResponse());
    const action = createResourceAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );
    await action.handler(
      buildCtx({ input: { parameters: undefined } }) as any,
    );

    let [, opts] = mockPOST.mock.calls[0];
    expect(opts.body.spec.parameters).toBeUndefined();

    mockPOST.mockResolvedValueOnce(successResponse());
    await action.handler(buildCtx({ input: { parameters: {} } }) as any);
    [, opts] = mockPOST.mock.calls[1];
    expect(opts.body.spec.parameters).toBeUndefined();
  });

  it('emits outputs naming the resource, namespace, project, and entity ref', async () => {
    mockPOST.mockResolvedValueOnce(successResponse());
    const action = createResourceAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );
    const ctx = buildCtx();
    await action.handler(ctx as any);

    expect(ctx.output).toHaveBeenCalledWith('resourceName', 'analytics-db');
    expect(ctx.output).toHaveBeenCalledWith('namespaceName', 'finance');
    expect(ctx.output).toHaveBeenCalledWith('projectName', 'analytics');
    expect(ctx.output).toHaveBeenCalledWith(
      'entityRef',
      'resource:finance/analytics-db',
    );
  });

  it('inserts the catalog Resource entity with the right type kind', async () => {
    mockPOST.mockResolvedValueOnce(successResponse());
    const action = createResourceAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );
    await action.handler(buildCtx() as any);

    expect(mockImmediateCatalog.insertEntity).toHaveBeenCalledTimes(1);
    const inserted = mockImmediateCatalog.insertEntity.mock.calls[0][0];
    expect(inserted.kind).toBe('Resource');
    expect(inserted.metadata.name).toBe('analytics-db');
    expect(inserted.metadata.namespace).toBe('finance');
    expect(inserted.metadata.annotations['openchoreo.io/resource-type']).toBe(
      'postgres',
    );
    expect(
      inserted.metadata.annotations['openchoreo.io/resource-type-kind'],
    ).toBe('ResourceType');
    expect(inserted.spec.owner).toBe('group:default/owners');
  });

  it('propagates ClusterResourceType when typeKind names that kind', async () => {
    mockPOST.mockResolvedValueOnce({
      data: {
        metadata: { name: 'shared-cache', namespace: 'finance' },
        spec: {
          owner: { projectName: 'analytics' },
          type: { kind: 'ClusterResourceType', name: 'redis' },
        },
      },
      error: undefined,
      response: { ok: true, status: 200 } as any,
    });

    const action = createResourceAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );
    await action.handler(
      buildCtx({
        input: {
          resourceName: 'shared-cache',
          typeKind: 'ClusterResourceType' as const,
          typeName: 'redis',
        },
      }) as any,
    );

    const [, opts] = mockPOST.mock.calls[0];
    expect(opts.body.spec.type).toEqual({
      kind: 'ClusterResourceType',
      name: 'redis',
    });
    const inserted = mockImmediateCatalog.insertEntity.mock.calls[0][0];
    expect(
      inserted.metadata.annotations['openchoreo.io/resource-type-kind'],
    ).toBe('ClusterResourceType');
  });

  it('threads parameters from input onto the inserted catalog entity', async () => {
    mockPOST.mockResolvedValueOnce(successResponse());
    const action = createResourceAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );
    await action.handler(
      buildCtx({
        input: { parameters: { size: 'small', replicas: 2 } },
      }) as any,
    );

    const inserted = mockImmediateCatalog.insertEntity.mock.calls[0][0];
    expect(inserted.spec.parameters).toEqual({ size: 'small', replicas: 2 });
  });

  it('wraps API errors with a "Failed to create Resource" message', async () => {
    mockPOST.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'boom' },
      response: { ok: false, status: 500 } as any,
    });
    const action = createResourceAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );

    await expect(action.handler(buildCtx() as any)).rejects.toThrow(
      /Failed to create Resource|boom/,
    );
    expect(mockImmediateCatalog.insertEntity).not.toHaveBeenCalled();
  });

  it('throws when authz is enabled and no user token is provided', async () => {
    const action = createResourceAction(
      buildConfig({ authzEnabled: true }),
      mockImmediateCatalog as any,
    );

    await expect(action.handler(buildCtx() as any)).rejects.toThrow(
      /User authentication token not available/,
    );
    expect(mockPOST).not.toHaveBeenCalled();
  });

  it('proceeds when authz is enabled and a token is supplied via secrets', async () => {
    mockPOST.mockResolvedValueOnce(successResponse());
    const action = createResourceAction(
      buildConfig({ authzEnabled: true }),
      mockImmediateCatalog as any,
    );
    const ctx = buildCtx({ secrets: { OPENCHOREO_USER_TOKEN: 'tkn' } });

    await action.handler(ctx as any);
    expect(mockPOST).toHaveBeenCalled();
    expect(ctx.output).toHaveBeenCalledWith('resourceName', 'analytics-db');
  });

  it('continues (does not throw) when catalog insertion fails', async () => {
    mockPOST.mockResolvedValueOnce(successResponse());
    mockImmediateCatalog.insertEntity.mockRejectedValueOnce(
      new Error('catalog down'),
    );
    const action = createResourceAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );
    const ctx = buildCtx();

    await action.handler(ctx as any);

    expect(ctx.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to immediately add Resource to catalog'),
    );
    expect(ctx.output).toHaveBeenCalledWith('resourceName', 'analytics-db');
  });

  it('accepts a namespace ref like `domain:default/finance` and strips it', async () => {
    mockPOST.mockResolvedValueOnce(successResponse());
    const action = createResourceAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );
    const ctx = buildCtx({ input: { namespaceName: 'domain:default/finance' } });

    await action.handler(ctx as any);

    expect(mockPOST.mock.calls[0][1].params.path.namespaceName).toBe('finance');
    expect(ctx.output).toHaveBeenCalledWith('namespaceName', 'finance');
  });

  it('accepts a project ref like `system:default/analytics` and strips it', async () => {
    mockPOST.mockResolvedValueOnce(successResponse());
    const action = createResourceAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );
    const ctx = buildCtx({
      input: { projectName: 'system:default/analytics' },
    });

    await action.handler(ctx as any);

    const [, opts] = mockPOST.mock.calls[0];
    expect(opts.body.spec.owner.projectName).toBe('analytics');
    expect(ctx.output).toHaveBeenCalledWith('projectName', 'analytics');
  });
});
