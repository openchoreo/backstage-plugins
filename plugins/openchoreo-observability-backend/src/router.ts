import { HttpAuthService } from '@backstage/backend-plugin-api';
import express from 'express';
import Router from 'express-promise-router';
import {
  observabilityServiceRef,
  ObservabilityNotConfiguredError,
} from './services/ObservabilityService';
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

  router.get('/resolve-urls', async (req, res) => {
    if (authEnabled) {
      await httpAuth.credentials(req, { allow: ['user'] });
    }
    const { namespaceName, environmentName } = req.query;
    if (!namespaceName || !environmentName) {
      return res
        .status(400)
        .json({ error: 'namespaceName and environmentName are required' });
    }
    const userToken = getUserTokenFromRequest(req);
    try {
      const urls = await observabilityService.resolveUrls(
        namespaceName as string,
        environmentName as string,
        userToken,
      );
      return res.status(200).json(urls);
    } catch (error) {
      if (error instanceof ObservabilityNotConfiguredError) {
        return res.status(404).json({ error: error.message });
      }
      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to resolve observer URLs',
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

  return router;
}
