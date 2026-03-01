import { startTestBackend } from '@backstage/backend-test-utils';
import { createServiceFactory } from '@backstage/backend-plugin-api';
import {
  observabilityServiceRef,
  ObservabilityNotConfiguredError,
} from './services/ObservabilityService';
import { openchoreoObservabilityBackendPlugin } from './plugin';
import request from 'supertest';

describe('plugin', () => {
  it('should resolve observer URLs', async () => {
    const { server } = await startTestBackend({
      features: [
        openchoreoObservabilityBackendPlugin,
        createServiceFactory({
          service: observabilityServiceRef,
          deps: {},
          factory: () => ({
            resolveUrls: jest.fn().mockResolvedValue({
              observerUrl: 'https://observer.example.com',
              rcaAgentUrl: 'https://rca.example.com',
            }),
            fetchEnvironmentsByNamespace: jest.fn().mockResolvedValue([]),
            fetchMetricsByComponent: jest.fn(),
            fetchTracesByProject: jest.fn(),
            fetchRuntimeLogsByComponent: jest.fn(),
          }),
        }),
      ],
    });

    const response = await request(server)
      .get('/api/openchoreo-observability-backend/resolve-urls')
      .query({ namespaceName: 'org-1', environmentName: 'dev' });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      observerUrl: 'https://observer.example.com',
      rcaAgentUrl: 'https://rca.example.com',
    });
  });

  it('should forward errors from the ObservabilityService', async () => {
    const { server } = await startTestBackend({
      features: [
        openchoreoObservabilityBackendPlugin,
        createServiceFactory({
          service: observabilityServiceRef,
          deps: {},
          factory: () => ({
            resolveUrls: jest
              .fn()
              .mockRejectedValue(new Error('Failed to resolve URLs')),
            fetchEnvironmentsByNamespace: jest
              .fn()
              .mockRejectedValue(new Error('Failed to fetch environments')),
            fetchMetricsByComponent: jest.fn(),
            fetchTracesByProject: jest.fn(),
            fetchRuntimeLogsByComponent: jest.fn(),
          }),
        }),
      ],
    });

    const response = await request(server)
      .get('/api/openchoreo-observability-backend/resolve-urls')
      .query({ namespaceName: 'org-1', environmentName: 'dev' });
    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      error: 'Failed to resolve URLs',
    });
  });

  it('should return 404 when observability is not configured', async () => {
    const { server } = await startTestBackend({
      features: [
        openchoreoObservabilityBackendPlugin,
        createServiceFactory({
          service: observabilityServiceRef,
          deps: {},
          factory: () => ({
            resolveUrls: jest
              .fn()
              .mockRejectedValue(new ObservabilityNotConfiguredError('org-1')),
            fetchEnvironmentsByNamespace: jest.fn().mockResolvedValue([]),
            fetchMetricsByComponent: jest.fn(),
            fetchTracesByProject: jest.fn(),
            fetchRuntimeLogsByComponent: jest.fn(),
          }),
        }),
      ],
    });

    const response = await request(server)
      .get('/api/openchoreo-observability-backend/resolve-urls')
      .query({ namespaceName: 'org-1', environmentName: 'dev' });
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      error: 'Observability is not configured for component org-1',
    });
  });
});
