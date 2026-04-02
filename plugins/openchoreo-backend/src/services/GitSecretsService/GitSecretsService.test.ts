import { mockServices } from '@backstage/backend-test-utils';
import { createOkResponse, createErrorResponse } from '@openchoreo/test-utils';
import { GitSecretsService } from './GitSecretsService';

const mockGET = jest.fn();
const mockPOST = jest.fn();
const mockDELETE = jest.fn();

jest.mock('@openchoreo/openchoreo-client-node', () => ({
  ...jest.requireActual('@openchoreo/openchoreo-client-node'),
  createOpenChoreoApiClient: jest.fn(() => ({
    GET: mockGET,
    POST: mockPOST,
    DELETE: mockDELETE,
  })),
}));

const mockLogger = mockServices.logger.mock();

function createService() {
  return new GitSecretsService(mockLogger, 'http://test:8080');
}

const gitSecretFixture = {
  name: 'my-git-token',
  type: 'basic-auth',
  createdAt: '2025-01-06T10:00:00Z',
};

describe('GitSecretsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listGitSecrets', () => {
    it('lists git secrets for a namespace', async () => {
      mockGET.mockResolvedValueOnce(
        createOkResponse({
          items: [gitSecretFixture],
          totalCount: 1,
          page: 1,
          pageSize: 100,
        }),
      );

      const service = createService();
      const result = await service.listGitSecrets('test-ns', 'token-123');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('my-git-token');
      expect(result.totalCount).toBe(1);
    });

    it('throws on API error', async () => {
      mockGET.mockResolvedValueOnce(createErrorResponse());

      const service = createService();
      await expect(
        service.listGitSecrets('test-ns', 'token'),
      ).rejects.toThrow();
    });
  });

  describe('createGitSecret', () => {
    it('creates a basic-auth git secret', async () => {
      mockPOST.mockResolvedValueOnce(createOkResponse(gitSecretFixture));

      const service = createService();
      const result = await service.createGitSecret(
        'test-ns',
        'my-git-token',
        'basic-auth',
        'ghp_abc123',
        undefined,
        'user',
        undefined,
        'token-123',
      );

      expect(result.name).toBe('my-git-token');
      expect(mockPOST).toHaveBeenCalledTimes(1);
    });

    it('creates with explicit workflowPlane kind and name', async () => {
      mockPOST.mockResolvedValueOnce(createOkResponse(gitSecretFixture));

      const service = createService();
      await service.createGitSecret(
        'test-ns',
        'secret',
        'ssh-auth',
        undefined,
        'ssh-key-content',
        undefined,
        'key-id',
        'token',
        'WorkflowPlane',
        'my-plane',
      );

      expect(mockPOST).toHaveBeenCalledTimes(1);
    });

    it('defaults workflowPlane to ClusterWorkflowPlane/default when both omitted', async () => {
      mockPOST.mockResolvedValueOnce(createOkResponse(gitSecretFixture));

      const service = createService();
      await service.createGitSecret(
        'test-ns',
        'secret',
        'basic-auth',
        'token-val',
      );

      expect(mockPOST).toHaveBeenCalledTimes(1);
    });

    it('throws when only workflowPlaneKind is provided without workflowPlaneName', async () => {
      const service = createService();
      await expect(
        service.createGitSecret(
          'test-ns',
          'secret',
          'basic-auth',
          'token-val',
          undefined,
          undefined,
          undefined,
          'user-token',
          'WorkflowPlane',
          undefined, // missing name
        ),
      ).rejects.toThrow(
        'workflowPlaneKind and workflowPlaneName must both be provided or both be omitted',
      );
    });

    it('throws when only workflowPlaneName is provided without workflowPlaneKind', async () => {
      const service = createService();
      await expect(
        service.createGitSecret(
          'test-ns',
          'secret',
          'basic-auth',
          'token-val',
          undefined,
          undefined,
          undefined,
          'user-token',
          undefined, // missing kind
          'my-plane',
        ),
      ).rejects.toThrow(
        'workflowPlaneKind and workflowPlaneName must both be provided or both be omitted',
      );
    });

    it('throws on API error', async () => {
      mockPOST.mockResolvedValueOnce(createErrorResponse());

      const service = createService();
      await expect(
        service.createGitSecret('test-ns', 'secret', 'basic-auth', 'token-val'),
      ).rejects.toThrow();
    });
  });

  describe('deleteGitSecret', () => {
    it('deletes a git secret', async () => {
      mockDELETE.mockResolvedValueOnce({
        error: undefined,
        response: { ok: true, status: 200 },
      });

      const service = createService();
      await service.deleteGitSecret('test-ns', 'my-git-token', 'token-123');

      expect(mockDELETE).toHaveBeenCalledTimes(1);
    });

    it('throws on API error', async () => {
      mockDELETE.mockResolvedValueOnce({
        error: { message: 'fail' },
        response: { ok: false, status: 404, statusText: 'Not Found' },
      });

      const service = createService();
      await expect(
        service.deleteGitSecret('test-ns', 'missing', 'token'),
      ).rejects.toThrow();
    });
  });
});
