import { HttpAuthService } from '@backstage/backend-plugin-api';
import express from 'express';
import Router from 'express-promise-router';
import { observabilityServiceRef } from './services/ObservabilityService';

export async function createRouter({
  httpAuth,
  observabilityService,
}: {
  httpAuth: HttpAuthService;
  observabilityService: typeof observabilityServiceRef.T;
}): Promise<express.Router> {
  const router = Router();
  router.use(express.json());

  router.get('/metrics', async (_req, res) => {
    const credentials = await httpAuth.credentials(_req, { allow: ['user'] });
    console.log(credentials);
    const metrics = await observabilityService.getMetrics();
    console.log(metrics);

    // Dummy metrics data
    const dummyMetrics = {
      timestamp: new Date().toISOString(),
      metrics: [
        {
          name: 'CPU Usage',
          value: 45.2,
          unit: '%',
          status: 'normal',
        },
        {
          name: 'Memory Usage',
          value: 68.5,
          unit: '%',
          status: 'normal',
        },
        {
          name: 'Request Count',
          value: 1234,
          unit: 'requests',
          status: 'normal',
        },
        {
          name: 'Error Rate',
          value: 2.1,
          unit: '%',
          status: 'warning',
        },
        {
          name: 'Response Time',
          value: 156,
          unit: 'ms',
          status: 'normal',
        },
      ],
    };
    res.json(dummyMetrics);
  });

  return router;
}
