import { createProjectTypeDefinitionAction } from './projectType';

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
  translateProjectTypeToEntity: jest.fn((data, ns, cfg) => ({
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'ProjectType',
    metadata: {
      name: data.name,
      namespace: ns,
      annotations: {
        'backstage.io/managed-by-location': `${cfg.locationKey}:pt`,
        'openchoreo.dev/display-name': data.displayName ?? '',
        'openchoreo.dev/description': data.description ?? '',
      },
    },
    spec: {},
  })),
}));

const buildConfig = (
  overrides: Partial<{ baseUrl: string; authzEnabled: boolean }> = {},
) => {
  const { baseUrl = 'http://test', authzEnabled = false } = overrides;
  return {
    getString: (k: string) => {
      if (k === 'openchoreo.baseUrl') return baseUrl;
      throw new Error(`unexpected getString: ${k}`);
    },
    getOptionalBoolean: (k: string) => {
      if (k === 'openchoreo.features.auth.enabled') return authzEnabled;
      return undefined;
    },
  } as any;
};

const buildYaml = (overrides: Record<string, string> = {}) => {
  const {
    apiVersion = 'openchoreo.dev/v1alpha1',
    kind = 'ProjectType',
    name = 'web-service',
    displayName = 'Web Service',
    description = 'A web service project type',
  } = overrides;
  return `apiVersion: ${apiVersion}
kind: ${kind}
metadata:
  name: ${name}
  annotations:
    openchoreo.dev/display-name: ${displayName}
    openchoreo.dev/description: ${description}
spec:
  parameters:
    openAPIV3Schema:
      type: object
`;
};

const buildCtx = (overrides: any = {}) => ({
  input: {
    namespaceName: 'finance',
    yamlContent: buildYaml(),
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

const successResponse = (name = 'web-service') => ({
  data: { metadata: { name, namespace: 'finance' } },
  error: undefined,
  response: { ok: true, status: 200 } as any,
});

describe('createProjectTypeDefinitionAction', () => {
  let mockImmediateCatalog: { insertEntity: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockImmediateCatalog = {
      insertEntity: jest.fn().mockResolvedValue(undefined),
    };
  });

  it('has the expected action id', () => {
    const action = createProjectTypeDefinitionAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );
    expect(action.id).toBe('openchoreo:projecttype-definition:create');
  });

  it('POSTs to the projecttypes endpoint, stripping apiVersion/kind from the body', async () => {
    mockPOST.mockResolvedValueOnce(successResponse());
    const action = createProjectTypeDefinitionAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );
    await action.handler(buildCtx() as any);

    expect(mockPOST).toHaveBeenCalledTimes(1);
    const [path, opts] = mockPOST.mock.calls[0];
    expect(path).toBe('/api/v1/namespaces/{namespaceName}/projecttypes');
    expect(opts.params.path.namespaceName).toBe('finance');
    expect(opts.body.apiVersion).toBeUndefined();
    expect(opts.body.kind).toBeUndefined();
    expect(opts.body.metadata.name).toBe('web-service');
    expect(opts.body.spec.parameters.openAPIV3Schema.type).toBe('object');
  });

  it('emits outputs naming the project type, namespace, and entity ref', async () => {
    mockPOST.mockResolvedValueOnce(successResponse());
    const action = createProjectTypeDefinitionAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );
    const ctx = buildCtx();
    await action.handler(ctx as any);

    expect(ctx.output).toHaveBeenCalledWith('projectTypeName', 'web-service');
    expect(ctx.output).toHaveBeenCalledWith('namespaceName', 'finance');
    expect(ctx.output).toHaveBeenCalledWith(
      'entityRef',
      'projecttype:finance/web-service',
    );
  });

  it('inserts the translated ProjectType into the catalog', async () => {
    mockPOST.mockResolvedValueOnce(successResponse());
    const action = createProjectTypeDefinitionAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );
    await action.handler(buildCtx() as any);

    expect(mockImmediateCatalog.insertEntity).toHaveBeenCalledTimes(1);
    const inserted = mockImmediateCatalog.insertEntity.mock.calls[0][0];
    expect(inserted.kind).toBe('ProjectType');
    expect(inserted.metadata.name).toBe('web-service');
    expect(inserted.metadata.namespace).toBe('finance');
  });

  it('accepts a namespace ref like `domain:default/finance` and strips it', async () => {
    mockPOST.mockResolvedValueOnce(successResponse());
    const action = createProjectTypeDefinitionAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );
    const ctx = buildCtx({
      input: { namespaceName: 'domain:default/finance' },
    });
    await action.handler(ctx as any);

    expect(mockPOST.mock.calls[0][1].params.path.namespaceName).toBe('finance');
    expect(ctx.output).toHaveBeenCalledWith('namespaceName', 'finance');
  });

  it('throws on invalid YAML content', async () => {
    const action = createProjectTypeDefinitionAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );
    await expect(
      action.handler(buildCtx({ input: { yamlContent: ': : :' } }) as any),
    ).rejects.toThrow(/Invalid YAML content/);
    expect(mockPOST).not.toHaveBeenCalled();
  });

  it('throws when the kind is not ProjectType', async () => {
    const action = createProjectTypeDefinitionAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );
    await expect(
      action.handler(
        buildCtx({
          input: { yamlContent: buildYaml({ kind: 'ResourceType' }) },
        }) as any,
      ),
    ).rejects.toThrow(/Kind must be ProjectType/);
    expect(mockPOST).not.toHaveBeenCalled();
  });

  it('throws when apiVersion is missing', async () => {
    const action = createProjectTypeDefinitionAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );
    const yamlContent = `kind: ProjectType
metadata:
  name: web-service
`;
    await expect(
      action.handler(buildCtx({ input: { yamlContent } }) as any),
    ).rejects.toThrow(/apiVersion is required/);
    expect(mockPOST).not.toHaveBeenCalled();
  });

  it('wraps API errors with a "create ProjectType" failure', async () => {
    mockPOST.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'boom' },
      response: { ok: false, status: 500 } as any,
    });
    const action = createProjectTypeDefinitionAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );

    await expect(action.handler(buildCtx() as any)).rejects.toThrow(
      /Failed to create ProjectType|boom|ProjectType/,
    );
    expect(mockImmediateCatalog.insertEntity).not.toHaveBeenCalled();
  });

  it('throws when authz is enabled and no user token is provided', async () => {
    const action = createProjectTypeDefinitionAction(
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
    const action = createProjectTypeDefinitionAction(
      buildConfig({ authzEnabled: true }),
      mockImmediateCatalog as any,
    );
    const ctx = buildCtx({ secrets: { OPENCHOREO_USER_TOKEN: 'tkn' } });
    await action.handler(ctx as any);

    expect(mockPOST).toHaveBeenCalled();
    expect(ctx.output).toHaveBeenCalledWith('projectTypeName', 'web-service');
  });

  it('continues (does not throw) when catalog insertion fails', async () => {
    mockPOST.mockResolvedValueOnce(successResponse());
    mockImmediateCatalog.insertEntity.mockRejectedValueOnce(
      new Error('catalog down'),
    );
    const action = createProjectTypeDefinitionAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );
    const ctx = buildCtx();
    await action.handler(ctx as any);

    expect(ctx.logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Failed to immediately add ProjectType to catalog',
      ),
    );
    expect(ctx.output).toHaveBeenCalledWith('projectTypeName', 'web-service');
  });
});
