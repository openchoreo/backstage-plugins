import { mockServices } from '@backstage/backend-test-utils';
import { ProjectReleaseInfoService } from './ProjectReleaseInfoService';
import { createOkResponse, createErrorResponse } from '@openchoreo/test-utils';

const mockGET = jest.fn();

jest.mock('@openchoreo/openchoreo-client-node', () => ({
  ...jest.requireActual('@openchoreo/openchoreo-client-node'),
  createOpenChoreoApiClient: jest.fn(() => ({
    GET: mockGET,
  })),
}));

const mockLogger = mockServices.logger.mock();

function createService() {
  return new ProjectReleaseInfoService(mockLogger, 'http://test:8080');
}

// A frozen ProjectRelease snapshot carrying both schema sections on the
// inlined (Cluster)ProjectType spec.
const projectRelease = {
  metadata: { name: 'my-project-abc', namespace: 'test-ns' },
  spec: {
    owner: { projectName: 'my-project' },
    projectType: {
      kind: 'ClusterProjectType',
      name: 'web-application',
      spec: {
        parameters: {
          openAPIV3Schema: {
            type: 'object',
            properties: { appName: { type: 'string' } },
          },
        },
        environmentConfigs: {
          openAPIV3Schema: {
            type: 'object',
            properties: { replicas: { type: 'integer' } },
          },
        },
      },
    },
    parameters: { appName: 'my-app' },
  },
};

describe('ProjectReleaseInfoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchProjectRelease', () => {
    it('returns the full release CR', async () => {
      mockGET.mockResolvedValueOnce(createOkResponse(projectRelease));

      const service = createService();
      const result = await service.fetchProjectRelease(
        'test-ns',
        'my-project-abc',
        'token-123',
      );

      expect(result.success).toBe(true);
      expect((result.data as any)?.spec?.parameters).toEqual({
        appName: 'my-app',
      });
      const call = mockGET.mock.calls[0];
      expect(call[0]).toBe(
        '/api/v1/namespaces/{namespaceName}/projectreleases/{projectReleaseName}',
      );
      expect(call[1].params.path).toEqual({
        namespaceName: 'test-ns',
        projectReleaseName: 'my-project-abc',
      });
    });

    it('throws when the API errors', async () => {
      mockGET.mockResolvedValueOnce(createErrorResponse(404));

      const service = createService();
      await expect(
        service.fetchProjectRelease('test-ns', 'missing', 'token-123'),
      ).rejects.toThrow();
    });
  });

  describe('fetchProjectReleaseSchema', () => {
    it('extracts the parameters openAPIV3Schema from the snapshot', async () => {
      mockGET.mockResolvedValueOnce(createOkResponse(projectRelease));

      const service = createService();
      const result = await service.fetchProjectReleaseSchema(
        'test-ns',
        'my-project-abc',
        'parameters',
        'token-123',
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        type: 'object',
        properties: { appName: { type: 'string' } },
      });
    });

    it('extracts the environmentConfigs openAPIV3Schema from the snapshot', async () => {
      mockGET.mockResolvedValueOnce(createOkResponse(projectRelease));

      const service = createService();
      const result = await service.fetchProjectReleaseSchema(
        'test-ns',
        'my-project-abc',
        'environmentConfigs',
        'token-123',
      );

      expect(result.data).toEqual({
        type: 'object',
        properties: { replicas: { type: 'integer' } },
      });
    });

    it('returns an empty schema when the section is not defined', async () => {
      mockGET.mockResolvedValueOnce(
        createOkResponse({
          metadata: { name: 'my-project-abc' },
          spec: {
            owner: { projectName: 'my-project' },
            projectType: { kind: 'ProjectType', name: 'minimal', spec: {} },
          },
        }),
      );

      const service = createService();
      const result = await service.fetchProjectReleaseSchema(
        'test-ns',
        'my-project-abc',
        'environmentConfigs',
        'token-123',
      );

      expect(result.data).toEqual({});
    });
  });
});
