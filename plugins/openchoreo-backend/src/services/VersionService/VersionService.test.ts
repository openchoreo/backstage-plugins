import { mockServices } from '@backstage/backend-test-utils';
import { createOkResponse, createErrorResponse } from '@openchoreo/test-utils';
import { VersionService } from './VersionService';

const mockGET = jest.fn();

jest.mock('@openchoreo/openchoreo-client-node', () => ({
  ...jest.requireActual('@openchoreo/openchoreo-client-node'),
  createOpenChoreoApiClient: jest.fn(() => ({
    GET: mockGET,
  })),
}));

const versionResponse = {
  name: 'openchoreo-api',
  version: 'v1.2.0',
  gitRevision: 'abc12345',
  buildTime: '2025-01-06T10:00:00Z',
  goOS: 'linux',
  goArch: 'amd64',
  goVersion: 'go1.24.2',
};

const mockLogger = mockServices.logger.mock();

function createService() {
  return new VersionService(mockLogger, 'http://test:8080');
}

describe('VersionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchPlatformVersion', () => {
    it('fetches the platform version', async () => {
      mockGET.mockResolvedValueOnce(createOkResponse(versionResponse));

      const service = createService();
      const result = await service.fetchPlatformVersion();

      expect(mockGET).toHaveBeenCalledWith('/version');
      expect(result).toEqual(versionResponse);
    });

    it('throws on API error', async () => {
      mockGET.mockResolvedValueOnce(createErrorResponse());

      const service = createService();
      await expect(service.fetchPlatformVersion()).rejects.toThrow();
    });
  });
});
