import { InputError } from '@backstage/errors';
import express from 'express';
import Router from 'express-promise-router';
import { EnvironmentInfoService } from './services/EnvironmentService/EnvironmentInfoService';
import {
  BuildInfoService,
  ObservabilityNotConfiguredError as BuildObservabilityNotConfiguredError,
} from './services/BuildService/BuildInfoService';
import {
  CellDiagramService,
  WorkloadService,
  SecretReferencesService,
} from './types';
import { ComponentInfoService } from './services/ComponentService/ComponentInfoService';
import { ProjectInfoService } from './services/ProjectService/ProjectInfoService';
import {
  RuntimeLogsInfoService,
  ObservabilityNotConfiguredError as RuntimeObservabilityNotConfiguredError,
} from './services/RuntimeLogsService/RuntimeLogsService';
import { DashboardInfoService } from './services/DashboardService/DashboardInfoService';
import { TraitInfoService } from './services/TraitService/TraitInfoService';
import { AuthzService } from './services/AuthzService/AuthzService';
import {
  OpenChoreoTokenService,
  createUserTokenMiddleware,
  getUserTokenFromRequest,
  createRequireAuthMiddleware,
} from '@openchoreo/openchoreo-auth';

export async function createRouter({
  environmentInfoService,
  cellDiagramInfoService,
  buildInfoService,
  componentInfoService,
  projectInfoService,
  runtimeLogsInfoService,
  workloadInfoService,
  dashboardInfoService,
  traitInfoService,
  secretReferencesInfoService,
  authzService,
  tokenService,
  authEnabled,
}: {
  environmentInfoService: EnvironmentInfoService;
  cellDiagramInfoService: CellDiagramService;
  buildInfoService: BuildInfoService;
  componentInfoService: ComponentInfoService;
  projectInfoService: ProjectInfoService;
  runtimeLogsInfoService: RuntimeLogsInfoService;
  workloadInfoService: WorkloadService;
  dashboardInfoService: DashboardInfoService;
  traitInfoService: TraitInfoService;
  secretReferencesInfoService: SecretReferencesService;
  authzService: AuthzService;
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

  router.get('/deploy', async (req, res) => {
    const { componentName, projectName, organizationName } = req.query;

    if (!componentName || !projectName || !organizationName) {
      throw new InputError(
        'componentName, projectName and organizationName are required query parameters',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await environmentInfoService.fetchDeploymentInfo(
        {
          componentName: componentName as string,
          projectName: projectName as string,
          organizationName: organizationName as string,
        },
        userToken,
      ),
    );
  });

  router.post('/promote-deployment', requireAuth, async (req, res) => {
    const { sourceEnv, targetEnv, componentName, projectName, orgName } =
      req.body;

    if (
      !sourceEnv ||
      !targetEnv ||
      !componentName ||
      !projectName ||
      !orgName
    ) {
      throw new InputError(
        'sourceEnv, targetEnv, componentName, projectName and orgName are required in request body',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await environmentInfoService.promoteComponent(
        {
          sourceEnvironment: sourceEnv,
          targetEnvironment: targetEnv,
          componentName: componentName as string,
          projectName: projectName as string,
          organizationName: orgName as string,
        },
        userToken,
      ),
    );
  });

  router.delete('/delete-release-binding', requireAuth, async (req, res) => {
    const { componentName, projectName, orgName, environment } = req.body;

    if (!componentName || !projectName || !orgName || !environment) {
      throw new InputError(
        'componentName, projectName, orgName and environment are required in request body',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await environmentInfoService.deleteReleaseBinding(
        {
          componentName: componentName as string,
          projectName: projectName as string,
          organizationName: orgName as string,
          environment: environment as string,
        },
        userToken,
      ),
    );
  });

  router.patch('/update-binding', requireAuth, async (req, res) => {
    const { componentName, projectName, orgName, bindingName, releaseState } =
      req.body;

    if (
      !componentName ||
      !projectName ||
      !orgName ||
      !bindingName ||
      !releaseState
    ) {
      throw new InputError(
        'componentName, projectName, orgName, bindingName and releaseState are required in request body',
      );
    }

    if (!['Active', 'Suspend', 'Undeploy'].includes(releaseState)) {
      throw new InputError(
        'releaseState must be one of: Active, Suspend, Undeploy',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await environmentInfoService.updateComponentBinding(
        {
          componentName: componentName as string,
          projectName: projectName as string,
          organizationName: orgName as string,
          bindingName: bindingName as string,
          releaseState: releaseState as 'Active' | 'Suspend' | 'Undeploy',
        },
        userToken,
      ),
    );
  });

  router.get(
    '/cell-diagram',
    async (req: express.Request, res: express.Response) => {
      const { projectName, organizationName } = req.query;

      if (!projectName || !organizationName) {
        throw new InputError(
          'projectName and organizationName are required query parameters',
        );
      }

      const userToken = getUserTokenFromRequest(req);

      res.json(
        await cellDiagramInfoService.fetchProjectInfo(
          {
            projectName: projectName as string,
            orgName: organizationName as string,
          },
          userToken,
        ),
      );
    },
  );

  // Endpoint for listing traits
  router.get('/traits', async (req, res) => {
    const { organizationName, limit, continue: continueToken } = req.query;

    if (!organizationName) {
      throw new InputError('organizationName is a required query parameter');
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await traitInfoService.fetchTraits(
        organizationName as string,
        userToken,
        limit ? parseInt(limit as string, 10) : undefined,
        continueToken as string | undefined,
      ),
    );
  });

  // Endpoint for fetching addon schema
  router.get('/trait-schema', async (req, res) => {
    const { organizationName, traitName } = req.query;

    if (!organizationName) {
      throw new InputError('organizationName is a required query parameter');
    }

    if (!traitName) {
      throw new InputError('traitName is a required query parameter');
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await traitInfoService.fetchTraitSchema(
        organizationName as string,
        traitName as string,
        userToken,
      ),
    );
  });

  // Endpoint for listing component traits
  router.get('/component-traits', async (req, res) => {
    const { organizationName, projectName, componentName } = req.query;

    if (!organizationName || !projectName || !componentName) {
      throw new InputError(
        'organizationName, projectName and componentName are required query parameters',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await traitInfoService.fetchComponentTraits(
        organizationName as string,
        projectName as string,
        componentName as string,
        userToken,
      ),
    );
  });

  // Endpoint for updating component traits
  router.put('/component-traits', requireAuth, async (req, res) => {
    const { organizationName, projectName, componentName, traits } = req.body;

    if (!organizationName || !projectName || !componentName) {
      throw new InputError(
        'organizationName, projectName and componentName are required in request body',
      );
    }

    if (!traits || !Array.isArray(traits)) {
      throw new InputError('traits must be an array in request body');
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await traitInfoService.updateComponentTraits(
        organizationName as string,
        projectName as string,
        componentName as string,
        { traits },
        userToken,
      ),
    );
  });
  router.get('/builds', async (req, res) => {
    const { componentName, projectName, organizationName } = req.query;

    if (!componentName || !projectName || !organizationName) {
      throw new InputError(
        'componentName, projectName and organizationName are required query parameters',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await buildInfoService.fetchBuilds(
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
      await buildInfoService.triggerBuild(
        organizationName as string,
        projectName as string,
        componentName as string,
        commit as string | undefined,
        userToken,
      ),
    );
  });

  router.get('/component', async (req, res) => {
    const { componentName, projectName, organizationName } = req.query;

    if (!componentName || !projectName || !organizationName) {
      throw new InputError(
        'componentName, projectName and organizationName are required query parameters',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await componentInfoService.fetchComponentDetails(
        organizationName as string,
        projectName as string,
        componentName as string,
        userToken,
      ),
    );
  });

  router.patch('/component', requireAuth, async (req, res) => {
    const { componentName, projectName, organizationName, autoDeploy } =
      req.body;

    if (!componentName || !projectName || !organizationName) {
      throw new InputError(
        'componentName, projectName and organizationName are required in request body',
      );
    }

    if (autoDeploy === undefined || typeof autoDeploy !== 'boolean') {
      throw new InputError('autoDeploy must be a boolean value');
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await componentInfoService.patchComponent(
        organizationName as string,
        projectName as string,
        componentName as string,
        autoDeploy as boolean,
        userToken,
      ),
    );
  });

  router.get('/project', async (req, res) => {
    const { projectName, organizationName } = req.query;

    if (!projectName || !organizationName) {
      throw new InputError(
        'projectName and organizationName are required query parameters',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await projectInfoService.fetchProjectDetails(
        organizationName as string,
        projectName as string,
        userToken,
      ),
    );
  });

  router.get('/deployment-pipeline', async (req, res) => {
    const { projectName, organizationName } = req.query;

    if (!projectName || !organizationName) {
      throw new InputError(
        'projectName and organizationName are required query parameters',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await projectInfoService.fetchProjectDeploymentPipeline(
        organizationName as string,
        projectName as string,
        userToken,
      ),
    );
  });

  router.get('/build-logs', async (req, res) => {
    const { componentName, buildId, buildUuid, projectName, orgName } =
      req.query;

    if (!componentName || !buildId || !buildUuid) {
      throw new InputError(
        'componentName, buildId and buildUuid are required query parameters',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    try {
      const result = await buildInfoService.fetchBuildLogs(
        orgName as string,
        projectName as string,
        componentName as string,
        buildId as string,
        undefined, // limit
        undefined, // sortOrder
        userToken,
      );
      return res.json(result);
    } catch (error: unknown) {
      if (error instanceof BuildObservabilityNotConfiguredError) {
        return res.status(200).json({
          message: "Observability hasn't been configured",
        });
      }
      throw error;
    }
  });

  // Runtime logs
  router.post(
    '/logs/component/:componentName',
    async (req: express.Request, res: express.Response) => {
      const { componentName } = req.params;
      const { orgName, projectName } = req.query;
      const {
        componentId,
        environmentName,
        environmentId,
        logLevels,
        startTime,
        endTime,
        limit,
      } = req.body;

      if (
        !componentName ||
        !componentId ||
        !environmentName ||
        !environmentId
      ) {
        return res.status(422).json({
          error: 'Missing Parameter',
          message:
            'Component Name, Component ID or Environment Name or Environment ID is missing from request',
        });
      }

      const userToken = getUserTokenFromRequest(req);

      try {
        const result = await runtimeLogsInfoService.fetchRuntimeLogs(
          {
            componentId,
            componentName,
            environmentId,
            environmentName,
            logLevels,
            startTime,
            endTime,
            limit,
          },
          orgName as string,
          projectName as string,
          userToken,
        );

        return res.json(result);
      } catch (error: unknown) {
        if (error instanceof RuntimeObservabilityNotConfiguredError) {
          return res.status(200).json({
            message: 'observability is disabled',
          });
        }

        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error occurred';

        // Check if it's a fetch error with status code info
        if (errorMessage.includes('Failed to fetch runtime logs: ')) {
          const statusMatch = errorMessage.match(
            /Failed to fetch runtime logs: (\d+)/,
          );
          if (statusMatch) {
            const statusCode = parseInt(statusMatch[1], 10);
            return res
              .status(statusCode >= 400 && statusCode < 600 ? statusCode : 500)
              .json({
                error: 'Failed to fetch runtime logs',
                message: errorMessage,
              });
          }
        }

        // Default to 500 for other errors
        return res.status(500).json({
          error: 'Internal server error',
          message: errorMessage,
        });
      }
    },
  );

  router.get('/workload', async (req, res) => {
    const { componentName, projectName, organizationName } = req.query;

    if (!componentName || !projectName || !organizationName) {
      throw new InputError(
        'componentName, projectName and organizationName are required query parameters',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    try {
      const result = await workloadInfoService.fetchWorkloadInfo(
        {
          componentName: componentName as string,
          projectName: projectName as string,
          organizationName: organizationName as string,
        },
        userToken,
      );

      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          name: error instanceof Error ? error.name : 'UnknownError',
          ...(error instanceof Error && error.stack && { stack: error.stack }),
        },
      });
    }
  });

  router.post('/workload', requireAuth, async (req, res) => {
    const { componentName, projectName, organizationName } = req.query;
    const workloadSpec = req.body;

    if (!componentName || !projectName || !organizationName) {
      throw new InputError(
        'componentName, projectName and organizationName are required query parameters',
      );
    }

    if (!workloadSpec) {
      throw new InputError(
        'Workload specification is required in request body',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    try {
      const result = await workloadInfoService.applyWorkload(
        {
          componentName: componentName as string,
          projectName: projectName as string,
          organizationName: organizationName as string,
          workloadSpec,
        },
        userToken,
      );

      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          name: error instanceof Error ? error.name : 'UnknownError',
          ...(error instanceof Error && error.stack && { stack: error.stack }),
        },
      });
    }
  });

  router.post('/dashboard/bindings-count', async (req, res) => {
    const { components } = req.body;

    if (!components || !Array.isArray(components)) {
      throw new InputError('components array is required in request body');
    }

    const userToken = getUserTokenFromRequest(req);

    try {
      const totalBindings =
        await dashboardInfoService.fetchComponentsBindingsCount(
          components,
          userToken,
        );

      res.json({ totalBindings });
    } catch (error) {
      res.status(500).json({
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          name: error instanceof Error ? error.name : 'UnknownError',
        },
      });
    }
  });

  router.post('/create-release', requireAuth, async (req, res) => {
    const { componentName, projectName, organizationName } = req.query;
    const { releaseName } = req.body;

    if (!componentName || !projectName || !organizationName) {
      throw new InputError(
        'componentName, projectName and organizationName are required query parameters',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await environmentInfoService.createComponentRelease(
        {
          componentName: componentName as string,
          projectName: projectName as string,
          organizationName: organizationName as string,
          releaseName: releaseName as string | undefined,
        },
        userToken,
      ),
    );
  });

  router.post('/deploy-release', requireAuth, async (req, res) => {
    const { componentName, projectName, organizationName } = req.query;
    const { releaseName } = req.body;

    if (!componentName || !projectName || !organizationName) {
      throw new InputError(
        'componentName, projectName and organizationName are required query parameters',
      );
    }

    if (!releaseName) {
      throw new InputError('releaseName is required in request body');
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await environmentInfoService.deployRelease(
        {
          componentName: componentName as string,
          projectName: projectName as string,
          organizationName: organizationName as string,
          releaseName: releaseName as string,
        },
        userToken,
      ),
    );
  });

  router.get('/component-release-schema', async (req, res) => {
    const { componentName, projectName, organizationName, releaseName } =
      req.query;

    if (!componentName || !projectName || !organizationName || !releaseName) {
      throw new InputError(
        'componentName, projectName, organizationName and releaseName are required query parameters',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await environmentInfoService.fetchComponentReleaseSchema(
        {
          componentName: componentName as string,
          projectName: projectName as string,
          organizationName: organizationName as string,
          releaseName: releaseName as string,
        },
        userToken,
      ),
    );
  });

  router.get('/release-bindings', async (req, res) => {
    const { componentName, projectName, organizationName } = req.query;

    if (!componentName || !projectName || !organizationName) {
      throw new InputError(
        'componentName, projectName and organizationName are required query parameters',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await environmentInfoService.fetchReleaseBindings(
        {
          componentName: componentName as string,
          projectName: projectName as string,
          organizationName: organizationName as string,
        },
        userToken,
      ),
    );
  });

  router.patch('/patch-release-binding', requireAuth, async (req, res) => {
    const {
      componentName,
      projectName,
      orgName,
      environment,
      componentTypeEnvOverrides,
      traitOverrides,
      workloadOverrides,
      releaseName,
    } = req.body;

    if (!componentName || !projectName || !orgName || !environment) {
      throw new InputError(
        'componentName, projectName, orgName and environment are required in request body',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await environmentInfoService.patchReleaseBindingOverrides(
        {
          componentName: componentName as string,
          projectName: projectName as string,
          organizationName: orgName as string,
          environment: environment as string,
          componentTypeEnvOverrides: componentTypeEnvOverrides,
          traitOverrides: traitOverrides,
          workloadOverrides: workloadOverrides,
          releaseName: releaseName as string | undefined,
        },
        userToken,
      ),
    );
  });

  router.get('/environment-release', async (req, res) => {
    const { componentName, projectName, organizationName, environmentName } =
      req.query;

    if (
      !componentName ||
      !projectName ||
      !organizationName ||
      !environmentName
    ) {
      throw new InputError(
        'componentName, projectName, organizationName and environmentName are required query parameters',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await environmentInfoService.fetchEnvironmentRelease(
        {
          componentName: componentName as string,
          projectName: projectName as string,
          organizationName: organizationName as string,
          environmentName: environmentName as string,
        },
        userToken,
      ),
    );
  });

  // Endpoint for listing secret references
  router.get('/secret-references', async (req, res) => {
    const { organizationName } = req.query;

    if (!organizationName) {
      throw new InputError('organizationName is a required query parameter');
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await secretReferencesInfoService.fetchSecretReferences(
        organizationName as string,
        userToken,
      ),
    );
  });

  // =====================
  // Authorization Endpoints
  // =====================

  // Roles
  router.get('/authz/roles', async (req, res) => {
    const userToken = getUserTokenFromRequest(req);
    res.json(await authzService.listRoles(userToken));
  });

  router.get('/authz/roles/:name', async (req, res) => {
    const { name } = req.params;
    const userToken = getUserTokenFromRequest(req);
    res.json(await authzService.getRole(name, userToken));
  });

  router.post('/authz/roles', requireAuth, async (req, res) => {
    const role = req.body;
    if (!role || !role.name || !role.actions) {
      throw new InputError('Role must have name and actions fields');
    }
    const userToken = getUserTokenFromRequest(req);
    res.json(await authzService.addRole(role, userToken));
  });

  router.put('/authz/roles/:name', requireAuth, async (req, res) => {
    const { name } = req.params;
    const { actions } = req.body;
    if (!actions || !Array.isArray(actions)) {
      throw new InputError('Request body must have actions array');
    }
    const userToken = getUserTokenFromRequest(req);
    res.json(await authzService.updateRole(name, actions, userToken));
  });

  router.delete('/authz/roles/:name', requireAuth, async (req, res) => {
    const { name } = req.params;
    const force = req.query.force === 'true';
    const userToken = getUserTokenFromRequest(req);
    await authzService.removeRole(name, force, userToken);
    res.status(204).send();
  });

  // Role Mappings
  router.get('/authz/role-mappings', async (req, res) => {
    const userToken = getUserTokenFromRequest(req);
    const filters = {
      role: req.query.role as string | undefined,
      claim: req.query.claim as string | undefined,
      value: req.query.value as string | undefined,
    };
    res.json(await authzService.listRoleMappings(filters, userToken));
  });

  router.post('/authz/role-mappings', requireAuth, async (req, res) => {
    const mapping = req.body;
    if (!mapping || !mapping.role_name || !mapping.entitlement) {
      throw new InputError(
        'Mapping must have role_name and entitlement fields',
      );
    }
    const userToken = getUserTokenFromRequest(req);
    res.json(await authzService.addRoleMapping(mapping, userToken));
  });

  router.put(
    '/authz/role-mappings/:mappingId',
    requireAuth,
    async (req, res) => {
      const mappingId = parseInt(req.params.mappingId, 10);
      if (isNaN(mappingId)) {
        throw new InputError('Invalid mapping ID');
      }
      const mapping = req.body;
      if (!mapping || !mapping.role_name || !mapping.entitlement) {
        throw new InputError(
          'Mapping must have role_name and entitlement fields',
        );
      }
      const userToken = getUserTokenFromRequest(req);
      res.json(
        await authzService.updateRoleMapping(mappingId, mapping, userToken),
      );
    },
  );

  router.delete('/authz/role-mappings', requireAuth, async (req, res) => {
    const mapping = req.body;
    if (!mapping || !mapping.id) {
      throw new InputError('Mapping must have an id field');
    }
    const userToken = getUserTokenFromRequest(req);
    await authzService.removeRoleMapping(mapping.id, userToken);
    res.status(204).send();
  });

  // Actions
  router.get('/authz/actions', async (req, res) => {
    const userToken = getUserTokenFromRequest(req);
    res.json(await authzService.listActions(userToken));
  });

  // User Types
  router.get('/user-types', async (req, res) => {
    const userToken = getUserTokenFromRequest(req);
    res.json(await authzService.listUserTypes(userToken));
  });

  // =====================
  // Hierarchy Data Endpoints (for Access Control autocomplete)
  // =====================

  // Organizations
  router.get('/orgs', async (req, res) => {
    const userToken = getUserTokenFromRequest(req);
    res.json(await authzService.listOrganizations(userToken));
  });

  // Projects (for a given organization)
  router.get('/orgs/:orgName/projects', async (req, res) => {
    const { orgName } = req.params;
    const userToken = getUserTokenFromRequest(req);
    res.json(await authzService.listProjects(orgName, userToken));
  });

  // Components (for a given organization and project)
  router.get(
    '/orgs/:orgName/projects/:projectName/components',
    async (req, res) => {
      const { orgName, projectName } = req.params;
      const userToken = getUserTokenFromRequest(req);
      res.json(
        await authzService.listComponents(orgName, projectName, userToken),
      );
    },
  );

  return router;
}
