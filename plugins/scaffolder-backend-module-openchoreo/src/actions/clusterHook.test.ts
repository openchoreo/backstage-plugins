import { createClusterHookDefinitionAction } from './clusterHook';

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

const buildYaml = (kind = 'ClusterHook') => `apiVersion: openchoreo.dev/v1alpha1
kind: ${kind}
metadata:
  name: scan
  annotations:
    openchoreo.dev/display-name: Image scan
    openchoreo.dev/description: Blocks CRITICAL findings
spec:
  type: Workflow
  workflowRef:
    kind: ClusterWorkflow
    name: trivy-image-scan
  enabledTo:
    - kind: ClusterComponentType
      name: service
  parameters:
    - name: image
      from: \${deployment.workload.containers.main.image}
    - name: ticket
      required: true
`;

const buildCtx = (overrides: any = {}) => ({
  input: { yamlContent: buildYaml(), ...overrides.input },
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
  output: jest.fn(),
  secrets: overrides.secrets,
});

const successResponse = () => ({
  data: {
    metadata: { name: 'scan' },
    spec: {
      type: 'Workflow',
      workflowRef: { kind: 'ClusterWorkflow', name: 'trivy-image-scan' },
      enabledTo: [{ kind: 'ClusterComponentType', name: 'service' }],
    },
  },
  error: undefined,
  response: { ok: true, status: 201 } as any,
});

// Same contract as the namespaced action: right endpoint, provider-shaped
// entity, and the webhook's message surfaced unchanged.
describe('createClusterHookDefinitionAction', () => {
  let immediateCatalog: { insertEntity: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    immediateCatalog = {
      insertEntity: jest.fn().mockResolvedValue(undefined),
    };
  });

  it('has the expected action id', () => {
    expect(
      createClusterHookDefinitionAction(buildConfig(), immediateCatalog as any)
        .id,
    ).toBe('openchoreo:clusterhook-definition:create');
  });

  it('POSTs to the clusterhooks endpoint, stripping apiVersion/kind, and outputs the entity ref', async () => {
    mockPOST.mockResolvedValueOnce(successResponse());
    const action = createClusterHookDefinitionAction(
      buildConfig(),
      immediateCatalog as any,
    );
    const ctx = buildCtx();
    await action.handler(ctx as any);

    expect(mockPOST).toHaveBeenCalledTimes(1);
    const [path, opts] = mockPOST.mock.calls[0];
    expect(path).toBe('/api/v1/clusterhooks');
    expect(opts.body.apiVersion).toBeUndefined();
    expect(opts.body.kind).toBeUndefined();
    expect(opts.body.spec.workflowRef).toEqual({
      kind: 'ClusterWorkflow',
      name: 'trivy-image-scan',
    });

    const entity = immediateCatalog.insertEntity.mock.calls[0][0];
    expect(entity.kind).toBe('ClusterHook');
    expect(entity.metadata.namespace).toBe('openchoreo-cluster');
    expect(entity.metadata.title).toBe('Image scan');
    expect(entity.metadata.annotations['openchoreo.io/workflow-ref']).toBe(
      'ClusterWorkflow/trivy-image-scan',
    );
    expect(entity.spec.domain).toBeUndefined();
    expect(entity.spec.enabledTo).toEqual([
      { kind: 'ClusterComponentType', name: 'service' },
    ]);
    expect(ctx.output).toHaveBeenCalledWith(
      'entityRef',
      'clusterhook:openchoreo-cluster/scan',
    );
  });

  it('rejects a manifest of another kind before calling the API', async () => {
    const action = createClusterHookDefinitionAction(
      buildConfig(),
      immediateCatalog as any,
    );
    await expect(
      action.handler(
        buildCtx({ input: { yamlContent: buildYaml('Hook') } }) as any,
      ),
    ).rejects.toThrow('Kind must be ClusterHook');
    expect(mockPOST).not.toHaveBeenCalled();
  });

  it('surfaces the admission webhook message verbatim on a 400', async () => {
    mockPOST.mockResolvedValueOnce({
      data: undefined,
      error: {
        message:
          'spec.workflowRef.kind: Invalid value: "Workflow": a ClusterHook may only reference a ClusterWorkflow',
      },
      response: { ok: false, status: 400 } as any,
    });
    const action = createClusterHookDefinitionAction(
      buildConfig(),
      immediateCatalog as any,
    );
    await expect(action.handler(buildCtx() as any)).rejects.toThrow(
      'a ClusterHook may only reference a ClusterWorkflow',
    );
    expect(immediateCatalog.insertEntity).not.toHaveBeenCalled();
  });

  it('fails on 403 and does not insert into the catalog', async () => {
    mockPOST.mockResolvedValueOnce({
      data: undefined,
      error: { message: 'forbidden' },
      response: { ok: false, status: 403 } as any,
    });
    const action = createClusterHookDefinitionAction(
      buildConfig(),
      immediateCatalog as any,
    );
    await expect(action.handler(buildCtx() as any)).rejects.toThrow(
      /forbidden/,
    );
    expect(immediateCatalog.insertEntity).not.toHaveBeenCalled();
  });

  it('requires a user token when auth is enabled', async () => {
    const action = createClusterHookDefinitionAction(
      buildConfig({ authzEnabled: true }),
      immediateCatalog as any,
    );
    await expect(action.handler(buildCtx() as any)).rejects.toThrow(
      /token not available/,
    );
    expect(mockPOST).not.toHaveBeenCalled();
  });
});
