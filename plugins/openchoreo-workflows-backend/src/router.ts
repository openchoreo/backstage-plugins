import { InputError } from '@backstage/errors';
import express from 'express';
import Router from 'express-promise-router';
import {
  GenericWorkflowService,
  ObservabilityNotConfiguredError,
} from './services';
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
  workflowService: GenericWorkflowService;
  tokenService: OpenChoreoTokenService;
  authEnabled: boolean;
}): Promise<express.Router> {
  const router = Router();
  router.use(express.json());

  // Add middleware to extract and cache user's IDP token from request headers
  router.use(createUserTokenMiddleware(tokenService));

  // Middleware to require authentication for mutating operations
  const requireAuth = createRequireAuthMiddleware(tokenService, authEnabled);

  // GET /workflows - List all workflow templates
  router.get('/workflows', async (req, res) => {
    const { namespaceName } = req.query;

    if (!namespaceName) {
      throw new InputError('namespaceName is required query parameter');
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await workflowService.listWorkflows(namespaceName as string, userToken),
    );
  });

  // GET /workflows/:workflowName/schema - Get workflow parameter schema
  router.get('/workflows/:workflowName/schema', async (req, res) => {
    const { workflowName } = req.params;
    const { namespaceName } = req.query;

    if (!namespaceName) {
      throw new InputError('namespaceName is required query parameter');
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await workflowService.getWorkflowSchema(
        namespaceName as string,
        workflowName,
        userToken,
      ),
    );
  });

  // GET /workflow-runs - List workflow runs (with optional workflow/project/component filter)
  router.get('/workflow-runs', async (req, res) => {
    const { namespaceName, workflowName, projectName, componentName } =
      req.query;

    if (!namespaceName) {
      throw new InputError('namespaceName is required query parameter');
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await workflowService.listWorkflowRuns(
        namespaceName as string,
        workflowName as string | undefined,
        userToken,
        projectName as string | undefined,
        componentName as string | undefined,
      ),
    );
  });

  // GET /workflow-runs/:runName - Get workflow run details
  router.get('/workflow-runs/:runName', async (req, res) => {
    const { runName } = req.params;
    const { namespaceName } = req.query;

    if (!namespaceName) {
      throw new InputError('namespaceName is required query parameter');
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await workflowService.getWorkflowRun(
        namespaceName as string,
        runName,
        userToken,
      ),
    );
  });

  // GET /workflow-runs/:runName/logs - Get workflow run logs
  router.get('/workflow-runs/:runName/logs', async (req, res) => {
    const { runName } = req.params;
    const { namespaceName, environmentName } = req.query;

    if (!namespaceName) {
      throw new InputError('namespaceName is required query parameter');
    }

    const userToken = getUserTokenFromRequest(req);

    try {
      const logs = await workflowService.getWorkflowRunLogs(
        namespaceName as string,
        runName,
        (environmentName as string) || 'development',
        userToken,
      );
      res.json(logs);
    } catch (error) {
      // Handle observability not configured gracefully
      if (error instanceof ObservabilityNotConfiguredError) {
        res.json({
          logs: [],
          totalCount: 0,
          tookMs: 0,
          error: 'OBSERVABILITY_NOT_CONFIGURED',
          message: error.message,
        });
        return;
      }
      throw error;
    }
  });

  // GET /workflow-runs/:runName/status - Get workflow run status (with steps)
  router.get('/workflow-runs/:runName/status', async (req, res) => {
    const { runName } = req.params;
    const { namespaceName } = req.query;

    if (!namespaceName) {
      throw new InputError('namespaceName is required query parameter');
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await workflowService.getWorkflowRunStatus(
        namespaceName as string,
        runName,
        userToken,
      ),
    );
  });

  // GET /workflow-runs/:runName/events - Get workflow run Kubernetes events
  router.get('/workflow-runs/:runName/events', async (req, res) => {
    const { runName } = req.params;
    const { namespaceName, step } = req.query;

    if (!namespaceName) {
      throw new InputError('namespaceName is required query parameter');
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await workflowService.getWorkflowRunEvents(
        namespaceName as string,
        runName,
        step as string | undefined,
        userToken,
      ),
    );
  });

  // POST /workflow-runs - Create (trigger) a new workflow run
  router.post('/workflow-runs', requireAuth, async (req, res) => {
    const { namespaceName } = req.query;
    const { workflowName, parameters, labels, annotations, workflowRunName } =
      req.body;

    if (!namespaceName) {
      throw new InputError('namespaceName is required query parameter');
    }

    if (!workflowName) {
      throw new InputError('workflowName is required in request body');
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await workflowService.createWorkflowRun(
        namespaceName as string,
        { workflowName, parameters, labels, annotations, workflowRunName },
        userToken,
      ),
    );
  });

  return router;
}
