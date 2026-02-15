import { HttpAuthService } from '@backstage/backend-plugin-api';
import express from 'express';
import Router from 'express-promise-router';
import {
  observabilityServiceRef,
  ObservabilityNotConfiguredError,
} from './services/ObservabilityService';
import { rcaAgentServiceRef } from './services/RCAAgentService';
import {
  OpenChoreoTokenService,
  createUserTokenMiddleware,
  getUserTokenFromRequest,
} from '@openchoreo/openchoreo-auth';

export async function createRouter({
  httpAuth,
  observabilityService,
  rcaAgentService,
  tokenService,
  authEnabled,
}: {
  httpAuth: HttpAuthService;
  observabilityService: typeof observabilityServiceRef.T;
  rcaAgentService: typeof rcaAgentServiceRef.T;
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
        _req.body.namespaceName,
        _req.body.projectName,
        _req.body.environmentName,
        _req.body.componentName,
        _req.body.options,
        userToken,
      );
      return res.status(200).json(metrics);
    } catch (error) {
      if (error instanceof ObservabilityNotConfiguredError) {
        return res.status(404).json({
          error: error.message,
        });
      }
      return res.status(500).json({
        error:
          error instanceof Error ? error.message : 'Failed to fetch metrics',
      });
    }
  });

  router.post('/logs/component/:componentName', async (_req, res) => {
    // Only enforce user auth when auth feature is enabled
    // When auth is disabled (guest mode), skip httpAuth check
    if (authEnabled) {
      await httpAuth.credentials(_req, { allow: ['user'] });
    }
    const userToken = getUserTokenFromRequest(_req);
    try {
      const logs = await observabilityService.fetchRuntimeLogsByComponent(
        _req.body.componentId,
        _req.body.projectId,
        _req.body.environmentId,
        _req.body.namespaceName,
        _req.body.projectName,
        _req.body.environmentName,
        _req.body.componentName,
        _req.body.options,
        userToken,
      );
      return res.status(200).json(logs);
    } catch (error) {
      if (error instanceof ObservabilityNotConfiguredError) {
        return res.status(404).json({
          error: error.message,
        });
      }
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to fetch logs',
      });
    }
  });

  router.get('/environments', async (req, res) => {
    // Only enforce user auth when auth feature is enabled
    if (authEnabled) {
      await httpAuth.credentials(req, { allow: ['user'] });
    }
    const { namespace } = req.query;
    if (!namespace) {
      return res.status(400).json({ error: 'Namespace is required' });
    }
    const userToken = getUserTokenFromRequest(req);
    try {
      const environments =
        await observabilityService.fetchEnvironmentsByNamespace(
          namespace as string,
          userToken,
        );
      return res.status(200).json({ environments });
    } catch (error) {
      if (error instanceof ObservabilityNotConfiguredError) {
        return res.status(404).json({
          error: error.message,
        });
      }
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
        _req.body.namespaceName,
        _req.body.projectName,
        _req.body.environmentName,
        _req.body.componentUids || [],
        _req.body.componentNames || [],
        _req.body.options,
        userToken,
      );
      return res.status(200).json(traces);
    } catch (error) {
      if (error instanceof ObservabilityNotConfiguredError) {
        return res.status(404).json({
          error: error.message,
        });
      }
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
      const reports = await rcaAgentService.fetchRCAReportsByProject(
        _req.body.namespaceName,
        _req.body.environmentName,
        _req.body.projectId,
        _req.body.environmentId,
        _req.body.componentUids || [],
        _req.body.options,
        userToken,
      );
      return res.status(200).json(reports);
    } catch (error) {
      if (error instanceof ObservabilityNotConfiguredError) {
        return res.status(404).json({
          error: error.message,
        });
      }
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
      const report = await rcaAgentService.fetchRCAReportByAlert(
        _req.body.namespaceName,
        _req.body.environmentName,
        alertId,
        _req.body.options,
        userToken,
      );
      return res.status(200).json(report);
    } catch (error) {
      if (error instanceof ObservabilityNotConfiguredError) {
        return res.status(404).json({
          error: error.message,
        });
      }
      return res.status(500).json({
        error:
          error instanceof Error ? error.message : 'Failed to fetch RCA report',
      });
    }
  });

  // Streaming chat endpoint for RCA agent
  router.post('/chat', async (_req, res): Promise<void> => {
    // Only enforce user auth when auth feature is enabled
    if (authEnabled) {
      await httpAuth.credentials(_req, { allow: ['user'] });
    }
    const userToken = getUserTokenFromRequest(_req);

    const {
      namespaceName,
      environmentName,
      reportId,
      projectUid,
      environmentUid,
      componentUid,
      messages,
      version,
    } = _req.body;

    if (
      !namespaceName ||
      !environmentName ||
      !reportId ||
      !projectUid ||
      !environmentUid ||
      !messages
    ) {
      res.status(400).json({
        error:
          'Missing required fields: namespaceName, environmentName, reportId, projectUid, environmentUid, messages',
      });
      return;
    }

    try {
      // Stream chat via RCA agent service
      const response = await rcaAgentService.streamChat(
        namespaceName,
        environmentName,
        {
          reportId,
          projectUid,
          environmentUid,
          componentUid,
          messages,
          version,
        },
        userToken,
      );

      if (!response.ok) {
        const errorText = await response.text();
        res.status(response.status).json({
          error: `RCA chat failed: ${response.status} ${response.statusText} - ${errorText}`,
        });
        return;
      }

      if (!response.body) {
        res.status(500).json({ error: 'No response body from RCA agent' });
        return;
      }

      // Set headers for streaming NDJSON response
      res.setHeader('Content-Type', 'application/x-ndjson');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Stream the response
      const reader = response.body.getReader();

      // Handle client disconnect
      _req.on('close', () => {
        reader.cancel();
      });

      try {
        let done = false;
        while (!done) {
          const result = await reader.read();
          done = result.done;
          if (done) break;
          res.write(result.value);
        }
        res.end();
      } catch {
        // Client likely disconnected
        reader.cancel();
      }
    } catch (error) {
      // Only send error response if headers haven't been sent
      if (!res.headersSent) {
        res.status(500).json({
          error:
            error instanceof Error
              ? error.message
              : 'Failed to stream RCA chat',
        });
      }
    }
  });

  return router;
}
