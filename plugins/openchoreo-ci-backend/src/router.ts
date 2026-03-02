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
    const { componentName, projectName, namespaceName } = req.query;

    if (!componentName || !projectName || !namespaceName) {
      throw new InputError(
        'componentName, projectName and namespaceName are required query parameters',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await workflowService.fetchBuilds(
        namespaceName as string,
        projectName as string,
        componentName as string,
        userToken,
      ),
    );
  });

  router.post('/builds', requireAuth, async (req, res) => {
    const { componentName, projectName, namespaceName, commit } = req.body;

    if (!componentName || !projectName || !namespaceName) {
      throw new InputError(
        'componentName, projectName and namespaceName are required in request body',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await workflowService.triggerBuild(
        namespaceName as string,
        projectName as string,
        componentName as string,
        commit as string | undefined,
        userToken,
      ),
    );
  });

  router.get('/workflow-run', async (req, res) => {
    const { componentName, projectName, namespaceName, runName } = req.query;

    if (!componentName || !projectName || !namespaceName || !runName) {
      throw new InputError(
        'componentName, projectName, namespaceName and runName are required query parameters',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await workflowService.getWorkflowRun(
        namespaceName as string,
        projectName as string,
        componentName as string,
        runName as string,
        userToken,
      ),
    );
  });

  router.get('/workflow-run-status', async (req, res) => {
    const { componentName, projectName, namespaceName, runName } = req.query;

    if (!componentName || !projectName || !namespaceName || !runName) {
      throw new InputError(
        'componentName, projectName, namespaceName and runName are required query parameters',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await workflowService.getWorkflowRunStatus(
        namespaceName as string,
        projectName as string,
        componentName as string,
        runName as string,
        userToken,
      ),
    );
  });

  router.get('/workflow-run-logs', async (req, res) => {
    const {
      namespaceName,
      projectName,
      componentName,
      runName,
      hasLiveObservability,
      step,
      sinceSeconds,
    } = req.query;

    if (!namespaceName || !projectName || !componentName || !runName) {
      throw new InputError(
        'namespaceName, projectName, componentName and runName are required query parameters',
      );
    }

    if (typeof hasLiveObservability !== 'string') {
      throw new InputError(
        'hasLiveObservability is a required query parameter',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    try {
      const entries = await workflowService.fetchWorkflowRunLogs(
        namespaceName as string,
        projectName as string,
        componentName as string,
        runName as string,
        hasLiveObservability === 'true',
        {
          step: typeof step === 'string' ? step : undefined,
          sinceSeconds:
            typeof sinceSeconds === 'string'
              ? Number.parseInt(sinceSeconds, 10)
              : undefined,
        },
        userToken,
      );

      res.json(entries);
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

  router.get('/workflow-run-events', async (req, res) => {
    const {
      namespaceName,
      projectName,
      componentName,
      runName,
      step,
      hasLiveObservability,
    } = req.query;

    if (!namespaceName || !projectName || !componentName || !runName || !step) {
      throw new InputError(
        'namespaceName, projectName, componentName, runName and step are required query parameters',
      );
    }

    if (typeof hasLiveObservability !== 'string') {
      throw new InputError(
        'hasLiveObservability is a required query parameter',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    try {
      const entries = await workflowService.fetchWorkflowRunEvents(
        namespaceName as string,
        projectName as string,
        componentName as string,
        runName as string,
        hasLiveObservability === 'true',
        step as string,
        userToken,
      );
      res.json(entries);
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

  router.get('/workflows', async (req, res) => {
    const { namespaceName } = req.query;

    if (!namespaceName) {
      throw new InputError('namespaceName is required query parameter');
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await workflowService.fetchWorkflows(namespaceName as string, userToken),
    );
  });

  router.get('/workflow-schema', async (req, res) => {
    const { namespaceName, workflowName } = req.query;

    if (!namespaceName || !workflowName) {
      throw new InputError(
        'namespaceName and workflowName are required query parameters',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await workflowService.fetchWorkflowSchema(
        namespaceName as string,
        workflowName as string,
        userToken,
      ),
    );
  });

  router.patch('/workflow-parameters', requireAuth, async (req, res) => {
    const { namespaceName, projectName, componentName } = req.query;

    if (!namespaceName || !projectName || !componentName) {
      throw new InputError(
        'namespaceName, projectName and componentName are required query parameters',
      );
    }

    const { systemParameters, parameters } = req.body;
    const userToken = getUserTokenFromRequest(req);

    res.json(
      await workflowService.updateComponentWorkflowParameters(
        namespaceName as string,
        projectName as string,
        componentName as string,
        systemParameters,
        parameters,
        userToken,
      ),
    );
  });

  return router;
}
