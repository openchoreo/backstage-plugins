import express from 'express';
import Router from 'express-promise-router';
import { PlatformEnvironmentInfoService } from './services/PlatformEnvironmentService';
import {
  OpenChoreoTokenService,
  createUserTokenMiddleware,
  getUserTokenFromRequest,
} from '@openchoreo/openchoreo-auth';

export interface RouterOptions {
  platformEnvironmentService: PlatformEnvironmentInfoService;
  tokenService: OpenChoreoTokenService;
}

export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const { platformEnvironmentService, tokenService } = options;
  const router = Router();

  router.use(express.json());

  // Add middleware to extract and cache user's IDP token from request headers
  router.use(createUserTokenMiddleware(tokenService));

  // Get all environments across the platform
  router.get('/environments', async (req, res) => {
    try {
      const userToken = getUserTokenFromRequest(req);
      const environments =
        await platformEnvironmentService.fetchAllEnvironments(userToken);
      res.json({
        success: true,
        data: environments,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get environments for a specific organization
  router.get('/environments/:orgName', async (req, res) => {
    try {
      const { orgName } = req.params;
      const userToken = getUserTokenFromRequest(req);
      const environments =
        await platformEnvironmentService.fetchEnvironmentsByOrganization(
          orgName,
          userToken,
        );
      res.json({
        success: true,
        data: environments,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get all dataplanes across the platform
  router.get('/dataplanes', async (req, res) => {
    try {
      const userToken = getUserTokenFromRequest(req);
      const dataplanes = await platformEnvironmentService.fetchAllDataplanes(
        userToken,
      );
      res.json({
        success: true,
        data: dataplanes,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get dataplanes for a specific organization
  router.get('/dataplanes/:orgName', async (req, res) => {
    try {
      const { orgName } = req.params;
      const userToken = getUserTokenFromRequest(req);
      const dataplanes =
        await platformEnvironmentService.fetchDataplanesByOrganization(
          orgName,
          userToken,
        );
      res.json({
        success: true,
        data: dataplanes,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get all dataplanes with their associated environments
  router.get('/dataplanes-with-environments', async (req, res) => {
    try {
      const userToken = getUserTokenFromRequest(req);
      const dataplanesWithEnvironments =
        await platformEnvironmentService.fetchDataplanesWithEnvironments(
          userToken,
        );
      res.json({
        success: true,
        data: dataplanesWithEnvironments,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get all dataplanes with their associated environments and component counts
  router.get(
    '/dataplanes-with-environments-and-components',
    async (req, res) => {
      try {
        const userToken = getUserTokenFromRequest(req);
        const dataplanesWithEnvironments =
          await platformEnvironmentService.fetchDataplanesWithEnvironmentsAndComponentCounts(
            userToken,
          );
        res.json({
          success: true,
          data: dataplanesWithEnvironments,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );

  // Get component counts per environment using bindings API
  router.post('/component-counts-per-environment', async (req, res) => {
    try {
      const { components } = req.body;

      if (!components || !Array.isArray(components)) {
        return res.status(400).json({
          success: false,
          error:
            'Invalid request body. Expected { components: Array<{orgName, projectName, componentName}> }',
        });
      }

      const userToken = getUserTokenFromRequest(req);
      const componentCounts =
        await platformEnvironmentService.fetchComponentCountsPerEnvironment(
          components,
          userToken,
        );

      // Convert Map to object for JSON response
      const countsObject = Object.fromEntries(componentCounts);

      return res.json({
        success: true,
        data: countsObject,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get distinct deployed components count using bindings API
  router.post('/distinct-deployed-components-count', async (req, res) => {
    try {
      const { components } = req.body;

      if (!components || !Array.isArray(components)) {
        return res.status(400).json({
          success: false,
          error:
            'Invalid request body. Expected { components: Array<{orgName, projectName, componentName}> }',
        });
      }

      const userToken = getUserTokenFromRequest(req);
      const distinctCount =
        await platformEnvironmentService.fetchDistinctDeployedComponentsCount(
          components,
          userToken,
        );

      return res.json({
        success: true,
        data: distinctCount,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get healthy workload count using bindings API
  router.post('/healthy-workload-count', async (req, res) => {
    try {
      const { components } = req.body;

      if (!components || !Array.isArray(components)) {
        return res.status(400).json({
          success: false,
          error:
            'Invalid request body. Expected { components: Array<{orgName, projectName, componentName}> }',
        });
      }

      const userToken = getUserTokenFromRequest(req);
      const healthyCount =
        await platformEnvironmentService.fetchHealthyWorkloadCount(
          components,
          userToken,
        );

      return res.json({
        success: true,
        data: healthyCount,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Health check endpoint
  router.get('/health', (_req, res) => {
    res.json({
      success: true,
      message: 'Platform Engineer Core Backend is healthy',
    });
  });

  return router;
}
