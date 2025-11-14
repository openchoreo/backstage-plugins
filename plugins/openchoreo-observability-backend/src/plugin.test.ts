import {
  startTestBackend,
} from '@backstage/backend-test-utils';
import { createServiceFactory } from '@backstage/backend-plugin-api';
import { observabilityServiceRef } from './services/ObservabilityService';
import { openchoreoObservabilityBackendPlugin } from './plugin';
import request from 'supertest';
import { ConflictError } from '@backstage/errors';

// TEMPLATE NOTE:
// Plugin tests are integration tests for your plugin, ensuring that all pieces
// work together end-to-end. You can still mock injected backend services
// however, just like anyone who installs your plugin might replace the
// services with their own implementations.
describe('plugin', () => {
  it('should get metrics', async () => {
    const { server } = await startTestBackend({
      features: [openchoreoObservabilityBackendPlugin],
    });

    await request(server).get('/api/openchoreo-observability-backend/metrics').expect(200, {
      items: [],
    });

    const createRes = await request(server)
      .get('/api/openchoreo-observability-backend/metrics');

    expect(createRes.status).toBe(201);
    expect(createRes.body).toEqual({
      timestamp: expect.any(String),
      metrics: expect.any(Array),
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
            getMetrics: jest.fn().mockRejectedValue(new ConflictError()),
          }),
        })
      ],
    });

    const getMetricsRes = await request(server)
      .get('/api/openchoreo-observability-backend/metrics');
    expect(getMetricsRes.status).toBe(409);
    expect(getMetricsRes.body).toMatchObject({
      error: { name: 'ConflictError' },
    });
  });
});
