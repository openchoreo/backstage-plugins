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

  router.post('/metrics', async (_req, res) => {
    await httpAuth.credentials(_req, { allow: ['user'] });
    try {
      const metrics = await observabilityService.fetchMetricsByComponent(
        _req.body.componentId,
        _req.body.environmentId,
        _req.body.orgName,
        _req.body.projectName,
        _req.body.options,
      );
      return res.status(200).json(metrics);
    } catch (error) {
      return res.status(500).json({
        error:
          error instanceof Error ? error.message : 'Failed to fetch metrics',
      });
    }
  });

  router.get('/environments', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const { organization } = req.query;
    if (!organization) {
      return res.status(400).json({ error: 'Organization is required' });
    }
    try {
      const environments =
        await observabilityService.fetchEnvironmentsByOrganization(
          organization as string,
        );
      return res.status(200).json({ environments });
    } catch (error) {
      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch environments',
      });
    }
  });

  return router;
}
