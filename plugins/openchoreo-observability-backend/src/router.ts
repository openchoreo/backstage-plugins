import { HttpAuthService } from '@backstage/backend-plugin-api';
import express from 'express';
import Router from 'express-promise-router';
import { observabilityServiceRef } from './services/ObservabilityService';
import {
  OpenChoreoTokenService,
  createUserTokenMiddleware,
  getUserTokenFromRequest,
} from '@openchoreo/openchoreo-auth';

export async function createRouter({
  httpAuth,
  observabilityService,
  tokenService,
  authEnabled,
}: {
  httpAuth: HttpAuthService;
  observabilityService: typeof observabilityServiceRef.T;
  tokenService: OpenChoreoTokenService;
  authEnabled: boolean;
}): Promise<express.Router> {
  const router = Router();
  router.use(express.json());

  // Add middleware to extract and cache user's IDP token from request headers
  router.use(createUserTokenMiddleware(tokenService));

  router.post('/metrics', async (_req, res) => {
    // Only enforce user auth when auth feature is enabled
    // When auth is disabled (guest mode), skip httpAuth check
    if (authEnabled) {
      await httpAuth.credentials(_req, { allow: ['user'] });
    }
    const userToken = getUserTokenFromRequest(_req);
    try {
      const metrics = await observabilityService.fetchMetricsByComponent(
        _req.body.componentId,
        _req.body.projectId,
        _req.body.environmentId,
        _req.body.orgName,
        _req.body.projectName,
        _req.body.environmentName,
        _req.body.componentName,
        _req.body.options,
        userToken,
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
    // Only enforce user auth when auth feature is enabled
    if (authEnabled) {
      await httpAuth.credentials(req, { allow: ['user'] });
    }
    const { organization } = req.query;
    if (!organization) {
      return res.status(400).json({ error: 'Organization is required' });
    }
    const userToken = getUserTokenFromRequest(req);
    try {
      const environments =
        await observabilityService.fetchEnvironmentsByOrganization(
          organization as string,
          userToken,
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

  router.post('/traces', async (_req, res) => {
    // Only enforce user auth when auth feature is enabled
    if (authEnabled) {
      await httpAuth.credentials(_req, { allow: ['user'] });
    }
    const userToken = getUserTokenFromRequest(_req);
    try {
      const traces = await observabilityService.fetchTracesByProject(
        _req.body.projectId,
        _req.body.environmentId,
        _req.body.orgName,
        _req.body.projectName,
        _req.body.environmentName,
        _req.body.componentUids || [],
        _req.body.options,
        userToken,
      );
      return res.status(200).json(traces);
    } catch (error) {
      return res.status(500).json({
        error:
          error instanceof Error ? error.message : 'Failed to fetch traces',
      });
    }
  });

  router.post('/rca-reports', async (_req, res) => {
    // Only enforce user auth when auth feature is enabled
    if (authEnabled) {
      await httpAuth.credentials(_req, { allow: ['user'] });
    }
    const userToken = getUserTokenFromRequest(_req);
    try {
      const reports = await observabilityService.fetchRCAReportsByProject(
        _req.body.projectId,
        _req.body.environmentId,
        _req.body.orgName,
        _req.body.environmentName,
        _req.body.componentUids || [],
        _req.body.options,
        userToken,
      );
      return res.status(200).json(reports);
    } catch (error) {
      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch RCA reports',
      });
    }
  });

  router.post('/rca-reports/alert/:alertId', async (_req, res) => {
    // Only enforce user auth when auth feature is enabled
    if (authEnabled) {
      await httpAuth.credentials(_req, { allow: ['user'] });
    }
    const userToken = getUserTokenFromRequest(_req);
    const { alertId } = _req.params;

    try {
      const report = await observabilityService.fetchRCAReportByAlert(
        alertId,
        _req.body.orgName,
        _req.body.environmentName,
        _req.body.options,
        userToken,
      );
      return res.status(200).json(report);
    } catch (error) {
      return res.status(500).json({
        error:
          error instanceof Error ? error.message : 'Failed to fetch RCA report',
      });
    }
  });

  return router;
}
