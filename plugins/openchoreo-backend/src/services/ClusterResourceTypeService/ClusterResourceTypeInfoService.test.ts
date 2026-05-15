import { mockServices } from '@backstage/backend-test-utils';
import { createOkResponse, createErrorResponse } from '@openchoreo/test-utils';
import { ClusterResourceTypeInfoService } from './ClusterResourceTypeInfoService';

const mockGET = jest.fn();

jest.mock('@openchoreo/openchoreo-client-node', () => ({
  ...jest.requireActual('@openchoreo/openchoreo-client-node'),
  createOpenChoreoApiClient: jest.fn(() => ({
    GET: mockGET,
  })),
}));

function createService() {
  return new ClusterResourceTypeInfoService(
    mockServices.logger.mock(),
    'http://test:8080',
  );
}

describe('ClusterResourceTypeInfoService.fetchClusterResourceTypeSchema', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches the parameters schema for a ClusterResourceType', async () => {
    const schema = {
      type: 'object',
      properties: { region: { type: 'string' } },
    };
    mockGET.mockResolvedValueOnce(createOkResponse(schema));

    const result = await createService().fetchClusterResourceTypeSchema(
      'redis',
      'token-123',
    );

    expect(result.success).toBe(true);
    expect(result.data).toEqual(schema);
    expect(mockGET).toHaveBeenCalledWith(
      '/api/v1/clusterresourcetypes/{crtName}/schema',
      expect.objectContaining({
        params: { path: { crtName: 'redis' } },
      }),
    );
  });

  it('throws when the upstream API returns an error', async () => {
    mockGET.mockResolvedValueOnce(createErrorResponse());

    await expect(
      createService().fetchClusterResourceTypeSchema('redis', 'token'),
    ).rejects.toThrow();
  });
});
