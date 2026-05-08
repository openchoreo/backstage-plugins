import { mockServices } from '@backstage/backend-test-utils';
import { ObservabilityService } from './ObservabilityService';

const mockGET = jest.fn();

jest.mock('@openchoreo/openchoreo-client-node', () => ({
  ...jest.requireActual('@openchoreo/openchoreo-client-node'),
  createOpenChoreoApiClient: jest.fn(() => ({ GET: mockGET })),
}));

const createOkResponse = <T>(data: T) => ({
  data,
  error: undefined,
  response: { ok: true as const, status: 200 },
});

const createErrorResponse = (status = 500, message = 'fail') => ({
  data: undefined,
  error: { message },
  response: { ok: false as const, status, statusText: message },
});

const logger = mockServices.logger.mock();

const makeProject = (pipelineName?: string) => ({
  metadata: { name: 'proj-1', namespace: 'ns-1' },
  spec: pipelineName
    ? {
        deploymentPipelineRef: {
          kind: 'DeploymentPipeline' as const,
          name: pipelineName,
        },
      }
    : {},
});

const makePipeline = (paths: Array<{ source: string; targets: string[] }>) => ({
  metadata: { name: 'pipe-1', namespace: 'ns-1' },
  spec: {
    promotionPaths: paths.map(p => ({
      sourceEnvironmentRef: { kind: 'Environment' as const, name: p.source },
      targetEnvironmentRefs: p.targets.map(t => ({
        kind: 'Environment' as const,
        name: t,
      })),
    })),
  },
});

const envItem = (name: string) => ({
  metadata: {
    name,
    namespace: 'ns-1',
    uid: `uid-${name}`,
    creationTimestamp: '2026-01-01T00:00:00Z',
  },
  spec: { isProduction: name === 'prod' },
});

const envList = (names: string[]) => ({
  items: names.map(envItem),
  pagination: { total: names.length },
});

describe('ObservabilityService.fetchEnvironmentsByNamespace', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const service = ObservabilityService.create(logger, 'http://test:8080');

  it('returns all environments when no project is specified', async () => {
    mockGET.mockResolvedValueOnce(
      createOkResponse(envList(['dev', 'staging', 'prod', 'sandbox'])),
    );

    const result = await service.fetchEnvironmentsByNamespace('ns-1');

    expect(result.map(e => e.name)).toEqual([
      'dev',
      'staging',
      'prod',
      'sandbox',
    ]);
    expect(mockGET).toHaveBeenCalledTimes(1);
  });

  it('filters environments to those in the project deployment pipeline', async () => {
    mockGET
      .mockResolvedValueOnce(createOkResponse(makeProject('pipe-1')))
      .mockResolvedValueOnce(
        createOkResponse(
          makePipeline([
            { source: 'dev', targets: ['staging'] },
            { source: 'staging', targets: ['prod'] },
          ]),
        ),
      )
      .mockResolvedValueOnce(
        createOkResponse(envList(['dev', 'staging', 'prod', 'sandbox'])),
      );

    const result = await service.fetchEnvironmentsByNamespace('ns-1', 'proj-1');

    expect(result.map(e => e.name).sort()).toEqual(['dev', 'prod', 'staging']);
    expect(mockGET).toHaveBeenCalledTimes(3);
  });

  it('returns an empty list when project lookup fails', async () => {
    mockGET
      .mockResolvedValueOnce(createErrorResponse(404, 'project not found'))
      .mockResolvedValueOnce(
        createOkResponse(envList(['dev', 'staging', 'prod'])),
      );

    const result = await service.fetchEnvironmentsByNamespace('ns-1', 'proj-1');

    expect(result).toEqual([]);
  });

  it('returns an empty list when project has no deploymentPipelineRef', async () => {
    mockGET
      .mockResolvedValueOnce(createOkResponse(makeProject(undefined)))
      .mockResolvedValueOnce(
        createOkResponse(envList(['dev', 'staging', 'prod'])),
      );

    const result = await service.fetchEnvironmentsByNamespace('ns-1', 'proj-1');

    expect(result).toEqual([]);
  });

  it('returns an empty list when pipeline lookup fails', async () => {
    mockGET
      .mockResolvedValueOnce(createOkResponse(makeProject('pipe-1')))
      .mockResolvedValueOnce(createErrorResponse(500, 'pipeline error'))
      .mockResolvedValueOnce(
        createOkResponse(envList(['dev', 'staging', 'prod'])),
      );

    const result = await service.fetchEnvironmentsByNamespace('ns-1', 'proj-1');

    expect(result).toEqual([]);
  });

  it('returns an empty list when the pipeline has no promotion paths', async () => {
    mockGET
      .mockResolvedValueOnce(createOkResponse(makeProject('pipe-1')))
      .mockResolvedValueOnce(createOkResponse(makePipeline([])))
      .mockResolvedValueOnce(
        createOkResponse(envList(['dev', 'staging', 'prod'])),
      );

    const result = await service.fetchEnvironmentsByNamespace('ns-1', 'proj-1');

    expect(result).toEqual([]);
  });

  it('returns an empty list when the environments endpoint fails', async () => {
    mockGET.mockResolvedValueOnce(createErrorResponse());

    const result = await service.fetchEnvironmentsByNamespace('ns-1');

    expect(result).toEqual([]);
  });
});
