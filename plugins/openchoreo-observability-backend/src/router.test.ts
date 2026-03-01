import {
  mockCredentials,
  mockErrorHandler,
  mockServices,
} from '@backstage/backend-test-utils';
import express from 'express';
import request from 'supertest';

import { createRouter } from './router';
import {
  observabilityServiceRef,
  ObservabilityNotConfiguredError,
} from './services/ObservabilityService';
import type { OpenChoreoTokenService } from '@openchoreo/openchoreo-auth';

describe('createRouter', () => {
  let app: express.Express;
  let observabilityService: jest.Mocked<typeof observabilityServiceRef.T>;
  let tokenService: jest.Mocked<OpenChoreoTokenService>;

  beforeEach(async () => {
    observabilityService = {
      fetchMetricsByComponent: jest.fn(),
      fetchEnvironmentsByNamespace: jest.fn(),
      fetchTracesByProject: jest.fn(),
      fetchRuntimeLogsByComponent: jest.fn(),
      resolveUrls: jest.fn(),
    };
    tokenService = {
      getUserToken: jest.fn().mockReturnValue(undefined),
      getUserTokenRequired: jest.fn().mockImplementation(() => {
        throw new Error('No token');
      }),
      getServiceToken: jest.fn().mockResolvedValue('mock-service-token'),
      hasServiceCredentials: jest.fn().mockReturnValue(false),
    };
    const router = await createRouter({
      httpAuth: mockServices.httpAuth(),
      observabilityService,
      tokenService,
      authEnabled: true,
    });
    app = express();
    app.use(router);
    app.use(mockErrorHandler());
  });

  it('should resolve observer URLs', async () => {
    observabilityService.resolveUrls.mockResolvedValue({
      observerUrl: 'https://observer.example.com',
      rcaAgentUrl: 'https://rca.example.com',
    });

    const response = await request(app)
      .get('/resolve-urls')
      .query({ namespaceName: 'org-1', environmentName: 'dev' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      observerUrl: 'https://observer.example.com',
      rcaAgentUrl: 'https://rca.example.com',
    });
  });

  it('should return 400 when resolve-urls is missing parameters', async () => {
    const response = await request(app).get('/resolve-urls').query({});

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: 'namespaceName and environmentName are required',
    });
  });

  it('should not allow unauthenticated requests to resolve-urls', async () => {
    const response = await request(app)
      .get('/resolve-urls')
      .query({ namespaceName: 'org-1', environmentName: 'dev' })
      .set('Authorization', mockCredentials.none.header());

    expect(response.status).toBe(401);
  });

  it('should return 404 when observability is not configured for resolve-urls', async () => {
    observabilityService.resolveUrls.mockRejectedValue(
      new ObservabilityNotConfiguredError('org-1'),
    );

    const response = await request(app)
      .get('/resolve-urls')
      .query({ namespaceName: 'org-1', environmentName: 'dev' });

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      error: 'Observability is not configured for component org-1',
    });
  });

  it('should return 500 for other errors on resolve-urls', async () => {
    observabilityService.resolveUrls.mockRejectedValue(
      new Error('Failed to resolve URLs'),
    );

    const response = await request(app)
      .get('/resolve-urls')
      .query({ namespaceName: 'org-1', environmentName: 'dev' });

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      error: 'Failed to resolve URLs',
    });
  });

  it('should fetch environments by namespace', async () => {
    const mockEnvironments = [
      {
        uid: 'env-1',
        name: 'dev',
        namespace: 'org-1',
        isProduction: false,
        createdAt: '2025-01-01T00:00:00Z',
      },
    ];
    observabilityService.fetchEnvironmentsByNamespace.mockResolvedValue(
      mockEnvironments,
    );

    const response = await request(app)
      .get('/environments')
      .query({ namespace: 'org-1' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ environments: mockEnvironments });
  });

  it('should return 400 when namespace is missing for environments', async () => {
    const response = await request(app).get('/environments').query({});

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: 'Namespace is required',
    });
  });
});
