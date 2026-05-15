import { mockServices } from '@backstage/backend-test-utils';
import { createOkResponse, createErrorResponse } from '@openchoreo/test-utils';
import { ResourceTypeInfoService } from './ResourceTypeInfoService';

const mockGET = jest.fn();

jest.mock('@openchoreo/openchoreo-client-node', () => ({
  ...jest.requireActual('@openchoreo/openchoreo-client-node'),
  createOpenChoreoApiClient: jest.fn(() => ({
    GET: mockGET,
  })),
}));

function createService() {
  return new ResourceTypeInfoService(
    mockServices.logger.mock(),
    'http://test:8080',
  );
}

describe('ResourceTypeInfoService.fetchResourceTypeSchema', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches the parameters schema for a namespaced ResourceType', async () => {
    const schema = {
      type: 'object',
      properties: { size: { type: 'string' } },
    };
    mockGET.mockResolvedValueOnce(createOkResponse(schema));

    const result = await createService().fetchResourceTypeSchema(
      'finance',
      'postgres',
      'token-123',
    );

    expect(result.success).toBe(true);
    expect(result.data).toEqual(schema);
    expect(mockGET).toHaveBeenCalledWith(
      '/api/v1/namespaces/{namespaceName}/resourcetypes/{rtName}/schema',
      expect.objectContaining({
        params: { path: { namespaceName: 'finance', rtName: 'postgres' } },
      }),
    );
  });

  it('throws when the upstream API returns an error', async () => {
    mockGET.mockResolvedValueOnce(createErrorResponse());

    await expect(
      createService().fetchResourceTypeSchema('finance', 'postgres', 'token'),
    ).rejects.toThrow();
  });
});
