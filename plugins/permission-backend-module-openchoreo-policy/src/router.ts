import { LoggerService } from '@backstage/backend-plugin-api';
import express from 'express';
import Router from 'express-promise-router';
import { AuthzProfileService } from './services';

/**
 * Router options for the OpenChoreo permission policy module.
 */
export interface RouterOptions {
  /** The authz profile service for fetching and caching capabilities */
  authzService: AuthzProfileService;
  /** Logger service */
  logger: LoggerService;
}

/**
 * Creates the router for the OpenChoreo permission policy module.
 *
 * This router exposes internal endpoints for managing user capability caches,
 * primarily used during sign-in to pre-cache capabilities.
 */
export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const { authzService, logger } = options;

  const router = Router();

  /**
   * POST /cache-capabilities
   *
   * Pre-caches user capabilities. Called by the auth module after successful sign-in
   * to ensure capabilities are available for permission checks.
   *
   * Request body:
   * - userEntityRef: string - The user's entity reference (e.g., "user:default/email@example.com")
   * - accessToken: string - The user's OpenChoreo IDP token
   *
   * Response:
   * - 200: { success: true }
   * - 400: { error: "Missing userEntityRef or accessToken" }
   * - 500: { error: "Failed to cache capabilities" }
   */
  router.post('/cache-capabilities', express.json(), async (req, res) => {
    const { userEntityRef, accessToken } = req.body;

    if (!userEntityRef || typeof userEntityRef !== 'string') {
      return res
        .status(400)
        .json({ error: 'Missing or invalid userEntityRef' });
    }

    if (!accessToken || typeof accessToken !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid accessToken' });
    }

    try {
      await authzService.preCacheCapabilities(userEntityRef, accessToken);
      logger.info(`Pre-cached capabilities for ${userEntityRef}`);
      return res.status(200).json({ success: true });
    } catch (error) {
      logger.error(
        `Failed to pre-cache capabilities for ${userEntityRef}`,
        error as Error,
      );
      return res.status(500).json({ error: 'Failed to cache capabilities' });
    }
  });

  return router;
}
