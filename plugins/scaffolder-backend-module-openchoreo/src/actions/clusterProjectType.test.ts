import { createClusterProjectTypeDefinitionAction } from './clusterProjectType';

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
  translateClusterProjectTypeToEntity: jest.fn((data, cfg) => ({
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'ClusterProjectType',
    metadata: {
      name: data.name,
      namespace: 'openchoreo-cluster',
      annotations: {
        'backstage.io/managed-by-location': `${cfg.locationKey}:cpt`,
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
    kind = 'ClusterProjectType',
    name = 'standard',
    displayName = 'Standard',
    description = 'A standard cluster project type',
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

const successResponse = (name = 'standard') => ({
  data: { metadata: { name } },
  error: undefined,
  response: { ok: true, status: 200 } as any,
});

describe('createClusterProjectTypeDefinitionAction', () => {
  let mockImmediateCatalog: { insertEntity: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockImmediateCatalog = {
      insertEntity: jest.fn().mockResolvedValue(undefined),
    };
  });

  it('has the expected action id', () => {
    const action = createClusterProjectTypeDefinitionAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );
    expect(action.id).toBe('openchoreo:clusterprojecttype-definition:create');
  });

  it('POSTs to the clusterprojecttypes endpoint, stripping apiVersion/kind', async () => {
    mockPOST.mockResolvedValueOnce(successResponse());
    const action = createClusterProjectTypeDefinitionAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );
    await action.handler(buildCtx() as any);

    expect(mockPOST).toHaveBeenCalledTimes(1);
    const [path, opts] = mockPOST.mock.calls[0];
    expect(path).toBe('/api/v1/clusterprojecttypes');
    expect(opts.body.apiVersion).toBeUndefined();
    expect(opts.body.kind).toBeUndefined();
    expect(opts.body.metadata.name).toBe('standard');
  });

  it('emits outputs naming the cluster project type and entity ref', async () => {
    mockPOST.mockResolvedValueOnce(successResponse());
    const action = createClusterProjectTypeDefinitionAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );
    const ctx = buildCtx();
    await action.handler(ctx as any);

    expect(ctx.output).toHaveBeenCalledWith(
      'clusterProjectTypeName',
      'standard',
    );
    expect(ctx.output).toHaveBeenCalledWith(
      'entityRef',
      'clusterprojecttype:openchoreo-cluster/standard',
    );
  });

  it('inserts the translated ClusterProjectType into the catalog', async () => {
    mockPOST.mockResolvedValueOnce(successResponse());
    const action = createClusterProjectTypeDefinitionAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );
    await action.handler(buildCtx() as any);

    expect(mockImmediateCatalog.insertEntity).toHaveBeenCalledTimes(1);
    const inserted = mockImmediateCatalog.insertEntity.mock.calls[0][0];
    expect(inserted.kind).toBe('ClusterProjectType');
    expect(inserted.metadata.name).toBe('standard');
    expect(inserted.metadata.namespace).toBe('openchoreo-cluster');
  });

  it('throws on invalid YAML content', async () => {
    const action = createClusterProjectTypeDefinitionAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );
    await expect(
      action.handler(buildCtx({ input: { yamlContent: ': : :' } }) as any),
    ).rejects.toThrow(/Invalid YAML content/);
    expect(mockPOST).not.toHaveBeenCalled();
  });

  it('throws when the kind is not ClusterProjectType', async () => {
    const action = createClusterProjectTypeDefinitionAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );
    await expect(
      action.handler(
        buildCtx({
          input: { yamlContent: buildYaml({ kind: 'ProjectType' }) },
        }) as any,
      ),
    ).rejects.toThrow(/Kind must be ClusterProjectType/);
    expect(mockPOST).not.toHaveBeenCalled();
  });

  it('throws when apiVersion is missing', async () => {
    const action = createClusterProjectTypeDefinitionAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );
    const yamlContent = `kind: ClusterProjectType
metadata:
  name: standard
`;
    await expect(
      action.handler(buildCtx({ input: { yamlContent } }) as any),
    ).rejects.toThrow(/apiVersion is required/);
    expect(mockPOST).not.toHaveBeenCalled();
  });

  it('wraps API errors with a "create ClusterProjectType" failure', async () => {
    mockPOST.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'boom' },
      response: { ok: false, status: 500 } as any,
    });
    const action = createClusterProjectTypeDefinitionAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );

    await expect(action.handler(buildCtx() as any)).rejects.toThrow(
      /Failed to create ClusterProjectType|boom|ClusterProjectType/,
    );
    expect(mockImmediateCatalog.insertEntity).not.toHaveBeenCalled();
  });

  it('throws when authz is enabled and no user token is provided', async () => {
    const action = createClusterProjectTypeDefinitionAction(
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
    const action = createClusterProjectTypeDefinitionAction(
      buildConfig({ authzEnabled: true }),
      mockImmediateCatalog as any,
    );
    const ctx = buildCtx({ secrets: { OPENCHOREO_USER_TOKEN: 'tkn' } });
    await action.handler(ctx as any);

    expect(mockPOST).toHaveBeenCalled();
    expect(ctx.output).toHaveBeenCalledWith(
      'clusterProjectTypeName',
      'standard',
    );
  });

  it('continues (does not throw) when catalog insertion fails', async () => {
    mockPOST.mockResolvedValueOnce(successResponse());
    mockImmediateCatalog.insertEntity.mockRejectedValueOnce(
      new Error('catalog down'),
    );
    const action = createClusterProjectTypeDefinitionAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );
    const ctx = buildCtx();
    await action.handler(ctx as any);

    expect(ctx.logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Failed to immediately add ClusterProjectType to catalog',
      ),
    );
    expect(ctx.output).toHaveBeenCalledWith(
      'clusterProjectTypeName',
      'standard',
    );
  });
});
