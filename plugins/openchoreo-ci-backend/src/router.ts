import { InputError } from '@backstage/errors';
import express from 'express';
import Router from 'express-promise-router';
import { WorkflowService, ObservabilityNotConfiguredError } from './services';
import {
  OpenChoreoTokenService,
  createUserTokenMiddleware,
  getUserTokenFromRequest,
  createRequireAuthMiddleware,
} from '@openchoreo/openchoreo-auth';

export async function createRouter({
  workflowService,
  tokenService,
  authEnabled,
}: {
  workflowService: WorkflowService;
  tokenService: OpenChoreoTokenService;
  authEnabled: boolean;
}): Promise<express.Router> {
  const router = Router();
  router.use(express.json());

  // Add middleware to extract and cache user's IDP token from request headers
  router.use(createUserTokenMiddleware(tokenService));

  // Middleware to require authentication for mutating operations
  // When auth is enabled, POST/PUT/PATCH/DELETE operations require a valid user token
  const requireAuth = createRequireAuthMiddleware(tokenService, authEnabled);

  router.get('/builds', async (req, res) => {
    const { componentName, projectName, organizationName } = req.query;

    if (!componentName || !projectName || !organizationName) {
      throw new InputError(
        'componentName, projectName and organizationName are required query parameters',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await workflowService.fetchBuilds(
        organizationName as string,
        projectName as string,
        componentName as string,
        userToken,
      ),
    );
  });

  router.post('/builds', requireAuth, async (req, res) => {
    const { componentName, projectName, organizationName, commit } = req.body;

    if (!componentName || !projectName || !organizationName) {
      throw new InputError(
        'componentName, projectName and organizationName are required in request body',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await workflowService.triggerBuild(
        organizationName as string,
        projectName as string,
        componentName as string,
        commit as string | undefined,
        userToken,
      ),
    );
  });

  router.get('/workflow-run', async (req, res) => {
    const { componentName, projectName, organizationName, runName } = req.query;

    if (!componentName || !projectName || !organizationName || !runName) {
      throw new InputError(
        'componentName, projectName, organizationName and runName are required query parameters',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await workflowService.getWorkflowRun(
        organizationName as string,
        projectName as string,
        componentName as string,
        runName as string,
        userToken,
      ),
    );
  });

  router.get('/workflows', async (req, res) => {
    const { organizationName } = req.query;

    if (!organizationName) {
      throw new InputError('organizationName is required query parameter');
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await workflowService.fetchWorkflows(
        organizationName as string,
        userToken,
      ),
    );
  });

  router.get('/workflow-schema', async (req, res) => {
    const { organizationName, workflowName } = req.query;

    if (!organizationName || !workflowName) {
      throw new InputError(
        'organizationName and workflowName are required query parameters',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await workflowService.fetchWorkflowSchema(
        organizationName as string,
        workflowName as string,
        userToken,
      ),
    );
  });

  router.patch('/workflow-parameters', requireAuth, async (req, res) => {
    const { organizationName, projectName, componentName } = req.query;

    if (!organizationName || !projectName || !componentName) {
      throw new InputError(
        'organizationName, projectName and componentName are required query parameters',
      );
    }

    const { systemParameters, parameters } = req.body;
    const userToken = getUserTokenFromRequest(req);

    res.json(
      await workflowService.updateComponentWorkflowParameters(
        organizationName as string,
        projectName as string,
        componentName as string,
        systemParameters,
        parameters,
        userToken,
      ),
    );
  });

  router.get('/build-logs', async (req, res) => {
    const { componentName, buildId, projectName, orgName } = req.query;

    if (!componentName || !buildId || !projectName || !orgName) {
      throw new InputError(
        'componentName, buildId, projectName and orgName are required query parameters',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    try {
      const logs = await workflowService.fetchBuildLogs(
        orgName as string,
        projectName as string,
        componentName as string,
        buildId as string,
        undefined,
        undefined,
        userToken,
      );

      res.json(logs);
    } catch (error) {
      if (error instanceof ObservabilityNotConfiguredError) {
        res.status(503).json({
          error: 'ObservabilityNotConfigured',
          message: error.message,
        });
        return;
      }
      throw error;
    }
  });

  return router;
}
