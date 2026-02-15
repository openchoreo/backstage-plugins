import { startTestBackend } from '@backstage/backend-test-utils';
import { createServiceFactory } from '@backstage/backend-plugin-api';
import {
  observabilityServiceRef,
  ObservabilityNotConfiguredError,
} from './services/ObservabilityService';
import { openchoreoObservabilityBackendPlugin } from './plugin';
import request from 'supertest';

const mockResourceMetricsTimeSeries = {
  cpuUsage: [
    {
      time: '2021-01-01T00:00:00Z',
      value: 100,
    },
  ],
  cpuRequests: [
    {
      time: '2021-01-01T00:00:00Z',
      value: 100,
    },
  ],
  cpuLimits: [
    {
      time: '2021-01-01T00:00:00Z',
      value: 100,
    },
  ],
  memory: [
    {
      time: '2021-01-01T00:00:00Z',
      value: 100,
    },
  ],
  memoryRequests: [
    {
      time: '2021-01-01T00:00:00Z',
      value: 100,
    },
  ],
  memoryLimits: [
    {
      time: '2021-01-01T00:00:00Z',
      value: 100,
    },
  ],
};

// TEMPLATE NOTE:
// Plugin tests are integration tests for your plugin, ensuring that all pieces
// work together end-to-end. You can still mock injected backend services
// however, just like anyone who installs your plugin might replace the
// services with their own implementations.
describe('plugin', () => {
  it('should get metrics', async () => {
    const { server } = await startTestBackend({
      features: [
        openchoreoObservabilityBackendPlugin,
        createServiceFactory({
          service: observabilityServiceRef,
          deps: {},
          factory: () => ({
            fetchMetricsByComponent: jest
              .fn()
              .mockResolvedValue(mockResourceMetricsTimeSeries),
            fetchEnvironmentsByNamespace: jest.fn().mockResolvedValue([]),
            fetchTracesByProject: jest.fn().mockResolvedValue({
              traces: [],
              tookMs: 0,
            }),
            fetchRuntimeLogsByComponent: jest.fn().mockResolvedValue({
              logs: [],
              totalCount: 0,
            }),
          }),
        }),
      ],
    });

    const response = await request(server)
      .post('/api/openchoreo-observability-backend/metrics')
      .send({
        componentId: 'component-1',
        environmentId: 'environment-1',
        namespaceName: 'namespace-1',
        projectName: 'project-1',
        options: {
          limit: 100,
          offset: 0,
          startTime: '2025-01-01T00:00:00Z',
          endTime: '2025-12-31T23:59:59Z',
        },
      });
    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockResourceMetricsTimeSeries);
  });

  it('should forward errors from the ObservabilityService', async () => {
    const { server } = await startTestBackend({
      features: [
        openchoreoObservabilityBackendPlugin,
        createServiceFactory({
          service: observabilityServiceRef,
          deps: {},
          factory: () => ({
            fetchMetricsByComponent: jest
              .fn()
              .mockRejectedValue(new Error('Failed to fetch metrics')),
            fetchEnvironmentsByNamespace: jest
              .fn()
              .mockRejectedValue(new Error('Failed to fetch environments')),
            fetchTracesByProject: jest
              .fn()
              .mockRejectedValue(new Error('Failed to fetch traces')),
            fetchRuntimeLogsByComponent: jest
              .fn()
              .mockRejectedValue(new Error('Failed to fetch runtime logs')),
          }),
        }),
      ],
    });

    const getMetricsRes = await request(server)
      .post('/api/openchoreo-observability-backend/metrics')
      .send({
        componentId: 'component-1',
        environmentId: 'environment-1',
        namespaceName: 'namespace-1',
        projectName: 'project-1',
        options: {
          limit: 100,
          offset: 0,
          startTime: '2025-01-01T00:00:00Z',
          endTime: '2025-12-31T23:59:59Z',
        },
      });
    expect(getMetricsRes.status).toBe(500);
    expect(getMetricsRes.body).toMatchObject({
      error: 'Failed to fetch metrics',
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
            fetchMetricsByComponent: jest
              .fn()
              .mockRejectedValue(
                new ObservabilityNotConfiguredError('component-1'),
              ),
            fetchEnvironmentsByNamespace: jest.fn().mockResolvedValue([]),
            fetchTracesByProject: jest.fn().mockResolvedValue({
              traces: [],
              tookMs: 0,
            }),
            fetchRuntimeLogsByComponent: jest.fn().mockResolvedValue({
              logs: [],
              totalCount: 0,
            }),
          }),
        }),
      ],
    });

    const getMetricsRes = await request(server)
      .post('/api/openchoreo-observability-backend/metrics')
      .send({
        componentId: 'component-1',
        environmentId: 'environment-1',
        namespaceName: 'namespace-1',
        projectName: 'project-1',
        options: {
          limit: 100,
          offset: 0,
          startTime: '2025-01-01T00:00:00Z',
          endTime: '2025-12-31T23:59:59Z',
        },
      });
    expect(getMetricsRes.status).toBe(404);
    expect(getMetricsRes.body).toMatchObject({
      error: 'Observability is not configured for component component-1',
    });
  });
});
