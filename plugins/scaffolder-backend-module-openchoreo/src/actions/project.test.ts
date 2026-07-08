import { translateProjectToEntity } from '@openchoreo/backstage-plugin-catalog-backend-module';
import { createProjectAction } from './project';

const mockPOST = jest.fn();
const mockGET = jest.fn();

jest.mock('@openchoreo/openchoreo-client-node', () => ({
  ...jest.requireActual('@openchoreo/openchoreo-client-node'),
  createOpenChoreoApiClient: jest.fn(() => ({
    POST: mockPOST,
    GET: mockGET,
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

// dev -> staging -> prod; staging appears as both target and source to
// exercise deduplication in the auto-deploy environment expansion.
const pipelineResponse = () => ({
  data: {
    metadata: { name: 'default-pipeline' },
    spec: {
      promotionPaths: [
        {
          sourceEnvironmentRef: { kind: 'Environment', name: 'dev' },
          targetEnvironmentRefs: [{ kind: 'Environment', name: 'staging' }],
        },
        {
          sourceEnvironmentRef: { kind: 'Environment', name: 'staging' },
          targetEnvironmentRefs: [{ kind: 'Environment', name: 'prod' }],
        },
      ],
    },
  },
  error: undefined,
  response: { ok: true, status: 200 } as any,
});

const bindingCreatedResponse = (status = 201) => ({
  data: {},
  error: undefined,
  response: { ok: true, status } as any,
});

const bindingErrorResponse = (status: number) => ({
  data: undefined,
  error: { message: `error ${status}` },
  response: { ok: false, status } as any,
});

const bindingCalls = () =>
  mockPOST.mock.calls.filter(
    ([path]) =>
      path === '/api/v1/namespaces/{namespaceName}/projectreleasebindings',
  );

describe('createProjectAction', () => {
  let mockImmediateCatalog: { insertEntity: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: pipeline fetch fails; auto deploy warns and skips the fan-out,
    // so tests not about auto deploy are unaffected.
    mockGET.mockResolvedValue({
      data: undefined,
      error: { message: 'not found' },
      response: { ok: false, status: 404 } as any,
    });
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

  it('includes type and parameters in the request body when provided', async () => {
    mockPOST.mockResolvedValueOnce(successResponse());
    const action = createProjectAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );
    const ctx = buildCtx({
      input: {
        typeKind: 'ClusterProjectType',
        typeName: 'web-app',
        parameters: { replicas: 3 },
      },
    });
    await action.handler(ctx as any);

    const body = mockPOST.mock.calls[0][1].body;
    expect(body.spec.type).toEqual({
      kind: 'ClusterProjectType',
      name: 'web-app',
    });
    expect(body.spec.parameters).toEqual({ replicas: 3 });
    expect(body.spec.deploymentPipelineRef).toEqual({
      kind: 'DeploymentPipeline',
      name: 'default-pipeline',
    });
  });

  it('omits type and parameters when not provided (legacy path)', async () => {
    mockPOST.mockResolvedValueOnce(successResponse());
    const action = createProjectAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );
    await action.handler(buildCtx() as any);

    const body = mockPOST.mock.calls[0][1].body;
    expect(body.spec.type).toBeUndefined();
    expect(body.spec.parameters).toBeUndefined();
    expect(body.spec.deploymentPipelineRef.name).toBe('default-pipeline');
  });

  it('defaults type kind to ProjectType when only typeName is given', async () => {
    mockPOST.mockResolvedValueOnce(successResponse());
    const action = createProjectAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );
    await action.handler(buildCtx({ input: { typeName: 'standard' } }) as any);
    expect(mockPOST.mock.calls[0][1].body.spec.type).toEqual({
      kind: 'ProjectType',
      name: 'standard',
    });
  });

  it('omits an empty parameters object from the body', async () => {
    mockPOST.mockResolvedValueOnce(successResponse());
    const action = createProjectAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );
    await action.handler(
      buildCtx({ input: { typeName: 'standard', parameters: {} } }) as any,
    );
    expect(mockPOST.mock.calls[0][1].body.spec.parameters).toBeUndefined();
  });

  it('passes project type into the catalog translation', async () => {
    mockPOST.mockResolvedValueOnce(successResponse());
    const action = createProjectAction(
      buildConfig(),
      mockImmediateCatalog as any,
    );
    await action.handler(
      buildCtx({
        input: { typeKind: 'ProjectType', typeName: 'web-app' },
      }) as any,
    );
    expect(translateProjectToEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        projectTypeName: 'web-app',
        projectTypeKind: 'ProjectType',
      }),
      expect.anything(),
      expect.anything(),
    );
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

  describe('auto deploy release binding fan-out', () => {
    it('creates one unpinned binding per pipeline environment, deduplicated in pipeline order', async () => {
      mockPOST.mockResolvedValueOnce(successResponse());
      mockGET.mockResolvedValue(pipelineResponse());
      mockPOST.mockResolvedValue(bindingCreatedResponse());

      const action = createProjectAction(
        buildConfig(),
        mockImmediateCatalog as any,
      );
      const ctx = buildCtx();
      await action.handler(ctx as any);

      expect(mockGET).toHaveBeenCalledWith(
        '/api/v1/namespaces/{namespaceName}/deploymentpipelines/{deploymentPipelineName}',
        {
          params: {
            path: {
              namespaceName: 'my-ns',
              deploymentPipelineName: 'default-pipeline',
            },
          },
        },
      );

      const calls = bindingCalls();
      expect(calls).toHaveLength(3);
      expect(calls.map(([, opts]) => opts.body.metadata.name)).toEqual([
        'my-project-dev',
        'my-project-staging',
        'my-project-prod',
      ]);
      for (const [, opts] of calls) {
        expect(opts.params.path.namespaceName).toBe('my-ns');
        expect(opts.body.spec.owner).toEqual({ projectName: 'my-project' });
        expect(opts.body.spec.projectRelease).toBeUndefined();
      }
      expect(calls.map(([, opts]) => opts.body.spec.environment)).toEqual([
        'dev',
        'staging',
        'prod',
      ]);
      expect(ctx.output).toHaveBeenCalledWith('createdBindings', [
        'my-project-dev',
        'my-project-staging',
        'my-project-prod',
      ]);
      // No failures, so the manual-deploy warning is suppressed.
      expect(ctx.output).toHaveBeenCalledWith('autoDeployFailed', false);
      expect(ctx.output).toHaveBeenCalledWith('failedEnvironments', '');
    });

    it('creates no bindings when autoDeploy is false', async () => {
      mockPOST.mockResolvedValueOnce(successResponse());
      mockGET.mockResolvedValue(pipelineResponse());

      const action = createProjectAction(
        buildConfig(),
        mockImmediateCatalog as any,
      );
      const ctx = buildCtx({ input: { autoDeploy: false } });
      await action.handler(ctx as any);

      expect(mockGET).not.toHaveBeenCalled();
      expect(bindingCalls()).toHaveLength(0);
      expect(ctx.output).toHaveBeenCalledWith('createdBindings', []);
    });

    it('treats 409 (binding already exists) as success', async () => {
      mockPOST.mockResolvedValueOnce(successResponse());
      mockGET.mockResolvedValue(pipelineResponse());
      mockPOST
        .mockResolvedValueOnce(bindingCreatedResponse())
        .mockResolvedValueOnce(bindingErrorResponse(409))
        .mockResolvedValueOnce(bindingCreatedResponse());

      const action = createProjectAction(
        buildConfig(),
        mockImmediateCatalog as any,
      );
      const ctx = buildCtx();
      await action.handler(ctx as any);

      expect(ctx.output).toHaveBeenCalledWith('createdBindings', [
        'my-project-dev',
        'my-project-staging',
        'my-project-prod',
      ]);
    });

    it('continues past per-environment failures and reports the rest', async () => {
      mockPOST.mockResolvedValueOnce(successResponse());
      mockGET.mockResolvedValue(pipelineResponse());
      mockPOST
        .mockResolvedValueOnce(bindingCreatedResponse())
        .mockResolvedValueOnce(bindingErrorResponse(500))
        .mockResolvedValueOnce(bindingCreatedResponse());

      const action = createProjectAction(
        buildConfig(),
        mockImmediateCatalog as any,
      );
      const ctx = buildCtx();
      await action.handler(ctx as any);

      expect(bindingCalls()).toHaveLength(3);
      expect(ctx.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('my-project-staging'),
      );
      expect(ctx.output).toHaveBeenCalledWith('createdBindings', [
        'my-project-dev',
        'my-project-prod',
      ]);
      // The failed environment is surfaced for the manual-deploy warning.
      expect(ctx.output).toHaveBeenCalledWith('autoDeployFailed', true);
      expect(ctx.output).toHaveBeenCalledWith('failedEnvironments', 'staging');
    });

    it('warns without failing the task when every binding create fails', async () => {
      mockPOST.mockResolvedValueOnce(successResponse());
      mockGET.mockResolvedValue(pipelineResponse());
      mockPOST.mockResolvedValue(bindingErrorResponse(403));

      const action = createProjectAction(
        buildConfig(),
        mockImmediateCatalog as any,
      );
      const ctx = buildCtx();
      await action.handler(ctx as any);

      // The project was already created, so the step succeeds and still emits
      // its outputs (letting the "View Project" link render); the binding
      // failures only surface as warnings.
      expect(bindingCalls()).toHaveLength(3);
      expect(ctx.output).toHaveBeenCalledWith('projectName', 'my-project');
      expect(ctx.output).toHaveBeenCalledWith('createdBindings', []);
      expect(ctx.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('created 0 of 3'),
      );
      // All environments failed, so the warning lists them all.
      expect(ctx.output).toHaveBeenCalledWith('autoDeployFailed', true);
      expect(ctx.output).toHaveBeenCalledWith(
        'failedEnvironments',
        'dev, staging, prod',
      );
    });

    it('warns without failing the task when the pipeline fetch fails', async () => {
      mockPOST.mockResolvedValueOnce(successResponse());
      // beforeEach default: GET resolves 404

      const action = createProjectAction(
        buildConfig(),
        mockImmediateCatalog as any,
      );
      const ctx = buildCtx();
      await action.handler(ctx as any);

      expect(bindingCalls()).toHaveLength(0);
      expect(ctx.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Deploy tab'),
      );
      expect(ctx.output).toHaveBeenCalledWith('projectName', 'my-project');
      expect(ctx.output).toHaveBeenCalledWith('createdBindings', []);
    });

    it('warns without failing when the pipeline has no environments', async () => {
      mockPOST.mockResolvedValueOnce(successResponse());
      mockGET.mockResolvedValue({
        data: { metadata: { name: 'default-pipeline' }, spec: {} },
        error: undefined,
        response: { ok: true, status: 200 } as any,
      });

      const action = createProjectAction(
        buildConfig(),
        mockImmediateCatalog as any,
      );
      const ctx = buildCtx();
      await action.handler(ctx as any);

      expect(bindingCalls()).toHaveLength(0);
      expect(ctx.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('no environments'),
      );
      expect(ctx.output).toHaveBeenCalledWith('createdBindings', []);
    });

    it('falls back to the default pipeline name when the input is empty', async () => {
      mockPOST.mockResolvedValueOnce(successResponse());
      mockGET.mockResolvedValue(pipelineResponse());
      mockPOST.mockResolvedValue(bindingCreatedResponse());

      const action = createProjectAction(
        buildConfig(),
        mockImmediateCatalog as any,
      );
      await action.handler(
        buildCtx({ input: { deploymentPipeline: '' } }) as any,
      );

      expect(mockGET.mock.calls[0][1].params.path.deploymentPipelineName).toBe(
        'default',
      );
    });
  });
});
