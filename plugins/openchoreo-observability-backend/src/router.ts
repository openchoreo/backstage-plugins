import { HttpAuthService, LoggerService } from '@backstage/backend-plugin-api';
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
import { NamespaceSpansObservabilityPlanesError } from '@openchoreo/openchoreo-client-node';

export async function createRouter({
  httpAuth,
  logger,
  observabilityService,
  tokenService,
  authEnabled,
}: {
  httpAuth: HttpAuthService;
  logger: LoggerService;
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
    // environmentName is optional: when absent, URLs resolve at namespace level
    // (used by cross-environment scopes such as the Insights pages).
    const { namespaceName, environmentName } = req.query;
    if (!namespaceName) {
      return res.status(400).json({ error: 'namespaceName is required' });
    }
    const userToken = getUserTokenFromRequest(req);
    try {
      const urls = await observabilityService.resolveUrls(
        namespaceName as string,
        (environmentName as string | undefined) ?? '',
        userToken,
      );
      return res.status(200).json(urls);
    } catch (error) {
      if (error instanceof ObservabilityNotConfiguredError) {
        return res.status(404).json({ error: error.message });
      }
      // A property of the deployment rather than a failure: the namespace's
      // environments report to different observability planes, so no single
      // observer can answer for the namespace. 409 with a code, so a caller can
      // act on it -- the Delivery Insights page drops its all-environments
      // option -- rather than matching on the message.
      if (error instanceof NamespaceSpansObservabilityPlanesError) {
        return res.status(409).json({
          error: error.message,
          code: 'NAMESPACE_SPANS_OBSERVABILITY_PLANES',
          planesByEnvironment: error.planesByEnvironment,
        });
      }
      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to resolve observer URLs',
      });
    }
  });

  // Platform-wide observer, for reads with no environment to resolve through
  // (the audit trail). Takes no query parameters for that reason.
  router.get('/resolve-platform-urls', async (req, res) => {
    if (authEnabled) {
      await httpAuth.credentials(req, { allow: ['user'] });
    }
    const userToken = getUserTokenFromRequest(req);
    try {
      const urls = await observabilityService.resolvePlatformUrls(userToken);
      return res.status(200).json(urls);
    } catch (error) {
      // The cause names cluster-internal resources.
      logger.error('Failed to resolve the platform observer URL', {
        error: error instanceof Error ? error.message : String(error),
      });
      return res.status(500).json({
        error: 'Failed to resolve the platform observer URL',
      });
    }
  });

  router.get('/dataplane-netpol-provider', async (req, res) => {
    if (authEnabled) {
      await httpAuth.credentials(req, { allow: ['user'] });
    }
    const { namespaceName, dpKind, dpName } = req.query;
    if (!namespaceName || !dpName) {
      return res
        .status(400)
        .json({ error: 'namespaceName and dpName are required' });
    }
    const userToken = getUserTokenFromRequest(req);
    try {
      const networkPolicyProvider =
        await observabilityService.fetchDataPlaneNetPolProvider(
          namespaceName as string,
          (dpKind as string) ?? 'DataPlane',
          dpName as string,
          userToken,
        );
      return res.status(200).json({ networkPolicyProvider });
    } catch (error) {
      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch dataplane network policy provider',
      });
    }
  });

  router.get('/release-binding', async (req, res) => {
    if (authEnabled) {
      await httpAuth.credentials(req, { allow: ['user'] });
    }
    const { namespaceName, bindingName } = req.query;
    if (!namespaceName || !bindingName) {
      return res
        .status(400)
        .json({ error: 'namespaceName and bindingName are required' });
    }
    const userToken = getUserTokenFromRequest(req);
    try {
      const { data, error, response } =
        await observabilityService.getReleaseBinding(
          namespaceName as string,
          bindingName as string,
          userToken,
        );
      if (error) {
        return res.status(response.status).json(error);
      }
      return res.status(200).json(data);
    } catch (error) {
      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch release binding',
      });
    }
  });

  router.put('/release-binding', async (req, res) => {
    if (authEnabled) {
      await httpAuth.credentials(req, { allow: ['user'] });
    }
    const { namespaceName, bindingName } = req.query;
    if (!namespaceName || !bindingName) {
      return res
        .status(400)
        .json({ error: 'namespaceName and bindingName are required' });
    }
    const userToken = getUserTokenFromRequest(req);
    try {
      const { data, error, response } =
        await observabilityService.updateReleaseBinding(
          namespaceName as string,
          bindingName as string,
          req.body,
          userToken,
        );
      if (error) {
        return res.status(response.status).json(error);
      }
      return res.status(200).json(data);
    } catch (error) {
      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update release binding',
      });
    }
  });

  router.get('/resource-release-binding', async (req, res) => {
    if (authEnabled) {
      await httpAuth.credentials(req, { allow: ['user'] });
    }
    const { namespaceName, bindingName } = req.query;
    if (!namespaceName || !bindingName) {
      return res
        .status(400)
        .json({ error: 'namespaceName and bindingName are required' });
    }
    const userToken = getUserTokenFromRequest(req);
    try {
      const { data, error, response } =
        await observabilityService.getResourceReleaseBinding(
          namespaceName as string,
          bindingName as string,
          userToken,
        );
      if (error) {
        return res.status(response.status).json(error);
      }
      return res.status(200).json(data);
    } catch (error) {
      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch resource release binding',
      });
    }
  });

  router.put('/resource-release-binding', async (req, res) => {
    if (authEnabled) {
      await httpAuth.credentials(req, { allow: ['user'] });
    }
    const { namespaceName, bindingName } = req.query;
    if (!namespaceName || !bindingName) {
      return res
        .status(400)
        .json({ error: 'namespaceName and bindingName are required' });
    }
    const userToken = getUserTokenFromRequest(req);
    try {
      const { data, error, response } =
        await observabilityService.updateResourceReleaseBinding(
          namespaceName as string,
          bindingName as string,
          req.body,
          userToken,
        );
      if (error) {
        return res.status(response.status).json(error);
      }
      return res.status(200).json(data);
    } catch (error) {
      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update resource release binding',
      });
    }
  });

  return router;
}
