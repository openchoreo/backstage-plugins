import {
  mockCredentials,
  mockErrorHandler,
  mockServices,
} from '@backstage/backend-test-utils';
import express from 'express';
import request from 'supertest';

import { createRouter } from './router';
import { observabilityServiceRef } from './services/ObservabilityService';
import { rcaAgentServiceRef } from './services/RCAAgentService';
import type { OpenChoreoTokenService } from '@openchoreo/openchoreo-auth';

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
// Testing the router directly allows you to write a unit test that mocks the provided options.
describe('createRouter', () => {
  let app: express.Express;
  let observabilityService: jest.Mocked<typeof observabilityServiceRef.T>;
  let rcaAgentService: jest.Mocked<typeof rcaAgentServiceRef.T>;
  let tokenService: jest.Mocked<OpenChoreoTokenService>;

  beforeEach(async () => {
    observabilityService = {
      fetchMetricsByComponent: jest.fn(),
      fetchEnvironmentsByNamespace: jest.fn(),
      fetchTracesByProject: jest.fn(),
      fetchRuntimeLogsByComponent: jest.fn(),
    };
    rcaAgentService = {
      resolveRCAAgentUrl: jest.fn(),
      createClient: jest.fn(),
      streamChat: jest.fn(),
      fetchRCAReportsByProject: jest.fn(),
      fetchRCAReportByAlert: jest.fn(),
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
      rcaAgentService,
      tokenService,
      authEnabled: true, // Test with auth enabled
    });
    app = express();
    app.use(router);
    app.use(mockErrorHandler());
  });

  it('should fetch metrics by component', async () => {
    observabilityService.fetchMetricsByComponent.mockResolvedValue(
      mockResourceMetricsTimeSeries,
    );

    const response = await request(app)
      .post('/metrics')
      .send({
        componentId: 'component-1',
        environmentId: 'environment-1',
        namespaceName: 'org-1',
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

  it('should not allow unauthenticated requests to fetch metrics by component', async () => {
    observabilityService.fetchMetricsByComponent.mockResolvedValue(
      mockResourceMetricsTimeSeries,
    );

    // TEMPLATE NOTE:
    // The HttpAuth mock service considers all requests to be authenticated as a
    // mock user by default. In order to test other cases we need to explicitly
    // pass an authorization header with mock credentials.
    const response = await request(app)
      .post('/metrics')
      .send({
        componentId: 'component-1',
        environmentId: 'environment-1',
        namespaceName: 'org-1',
        projectName: 'project-1',
        options: {
          limit: 100,
          offset: 0,
          startTime: '2025-01-01T00:00:00Z',
          endTime: '2025-12-31T23:59:59Z',
        },
      })
      .set('Authorization', mockCredentials.none.header());

    expect(response.status).toBe(401);
  });
});
