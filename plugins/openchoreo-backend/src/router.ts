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
  GitSecretsService,
} from './types';
import { ComponentInfoService } from './services/ComponentService/ComponentInfoService';
import { ProjectInfoService } from './services/ProjectService/ProjectInfoService';
import { DashboardInfoService } from './services/DashboardService/DashboardInfoService';
import { TraitInfoService } from './services/TraitService/TraitInfoService';
import { AuthzService } from './services/AuthzService/AuthzService';
import { DataPlaneInfoService } from './services/DataPlaneService/DataPlaneInfoService';
import {
  OpenChoreoTokenService,
  createUserTokenMiddleware,
  getUserTokenFromRequest,
  createRequireAuthMiddleware,
} from '@openchoreo/openchoreo-auth';
import type { LoggerService } from '@backstage/backend-plugin-api';

export async function createRouter({
  environmentInfoService,
  cellDiagramInfoService,
  buildInfoService,
  componentInfoService,
  projectInfoService,
  workloadInfoService,
  dashboardInfoService,
  traitInfoService,
  secretReferencesInfoService,
  gitSecretsService,
  authzService,
  dataPlaneInfoService,
  tokenService,
  authEnabled,
  logger,
}: {
  environmentInfoService: EnvironmentInfoService;
  cellDiagramInfoService: CellDiagramService;
  buildInfoService: BuildInfoService;
  componentInfoService: ComponentInfoService;
  projectInfoService: ProjectInfoService;
  workloadInfoService: WorkloadService;
  dashboardInfoService: DashboardInfoService;
  traitInfoService: TraitInfoService;
  secretReferencesInfoService: SecretReferencesService;
  gitSecretsService: GitSecretsService;
  authzService: AuthzService;
  dataPlaneInfoService: DataPlaneInfoService;
  tokenService: OpenChoreoTokenService;
  authEnabled: boolean;
  logger: LoggerService;
}): Promise<express.Router> {
  const router = Router();
  router.use(express.json());

  // Add middleware to extract and cache user's IDP token from request headers
  router.use(createUserTokenMiddleware(tokenService));

  // Middleware to require authentication for mutating operations
  // When auth is enabled, POST/PUT/PATCH/DELETE operations require a valid user token
  const requireAuth = createRequireAuthMiddleware(tokenService, authEnabled);

  router.get('/deploy', async (req, res) => {
    const { componentName, projectName, namespaceName } = req.query;

    if (!componentName || !projectName || !namespaceName) {
      throw new InputError(
        'componentName, projectName and namespaceName are required query parameters',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await environmentInfoService.fetchDeploymentInfo(
        {
          componentName: componentName as string,
          projectName: projectName as string,
          namespaceName: namespaceName as string,
        },
        userToken,
      ),
    );
  });

  router.post('/promote-deployment', requireAuth, async (req, res) => {
    const { sourceEnv, targetEnv, componentName, projectName, namespaceName } =
      req.body;

    if (
      !sourceEnv ||
      !targetEnv ||
      !componentName ||
      !projectName ||
      !namespaceName
    ) {
      throw new InputError(
        'sourceEnv, targetEnv, componentName, projectName and namespaceName are required in request body',
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
          namespaceName: namespaceName as string,
        },
        userToken,
      ),
    );
  });

  router.delete('/delete-release-binding', requireAuth, async (req, res) => {
    const { componentName, projectName, namespaceName, environment } = req.body;

    if (!componentName || !projectName || !namespaceName || !environment) {
      throw new InputError(
        'componentName, projectName, namespaceName and environment are required in request body',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await environmentInfoService.deleteReleaseBinding(
        {
          componentName: componentName as string,
          projectName: projectName as string,
          namespaceName: namespaceName as string,
          environment: environment as string,
        },
        userToken,
      ),
    );
  });

  router.patch('/update-binding', requireAuth, async (req, res) => {
    const {
      componentName,
      projectName,
      namespaceName,
      bindingName,
      releaseState,
    } = req.body;

    if (
      !componentName ||
      !projectName ||
      !namespaceName ||
      !bindingName ||
      !releaseState
    ) {
      throw new InputError(
        'componentName, projectName, namespaceName, bindingName and releaseState are required in request body',
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
          namespaceName: namespaceName as string,
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
      const { projectName, namespaceName } = req.query;

      if (!projectName || !namespaceName) {
        throw new InputError(
          'projectName and namespaceName are required query parameters',
        );
      }

      const userToken = getUserTokenFromRequest(req);

      res.json(
        await cellDiagramInfoService.fetchProjectInfo(
          {
            projectName: projectName as string,
            namespaceName: namespaceName as string,
          },
          userToken,
        ),
      );
    },
  );

  // Endpoint for listing traits
  router.get('/traits', async (req, res) => {
    const { namespaceName, page, pageSize } = req.query;

    if (!namespaceName) {
      throw new InputError('namespaceName is a required query parameter');
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await traitInfoService.fetchTraits(
        namespaceName as string,
        page ? parseInt(page as string, 10) : undefined,
        pageSize ? parseInt(pageSize as string, 10) : undefined,
        userToken,
      ),
    );
  });

  // Endpoint for fetching addon schema
  router.get('/trait-schema', async (req, res) => {
    const { namespaceName, traitName } = req.query;

    if (!namespaceName) {
      throw new InputError('namespaceName is a required query parameter');
    }

    if (!traitName) {
      throw new InputError('traitName is a required query parameter');
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await traitInfoService.fetchTraitSchema(
        namespaceName as string,
        traitName as string,
        userToken,
      ),
    );
  });

  // Endpoint for listing component traits
  router.get('/component-traits', async (req, res) => {
    const { namespaceName, projectName, componentName } = req.query;

    if (!namespaceName || !projectName || !componentName) {
      throw new InputError(
        'namespaceName, projectName and componentName are required query parameters',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await traitInfoService.fetchComponentTraits(
        namespaceName as string,
        projectName as string,
        componentName as string,
        userToken,
      ),
    );
  });

  // Endpoint for updating component traits
  router.put('/component-traits', requireAuth, async (req, res) => {
    const { namespaceName, projectName, componentName, traits } = req.body;

    if (!namespaceName || !projectName || !componentName) {
      throw new InputError(
        'namespaceName, projectName and componentName are required in request body',
      );
    }

    if (!traits || !Array.isArray(traits)) {
      throw new InputError('traits must be an array in request body');
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await traitInfoService.updateComponentTraits(
        namespaceName as string,
        projectName as string,
        componentName as string,
        { traits },
        userToken,
      ),
    );
  });
  router.get('/builds', async (req, res) => {
    const { componentName, projectName, namespaceName } = req.query;

    if (!componentName || !projectName || !namespaceName) {
      throw new InputError(
        'componentName, projectName and namespaceName are required query parameters',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await buildInfoService.fetchBuilds(
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
      await buildInfoService.triggerBuild(
        namespaceName as string,
        projectName as string,
        componentName as string,
        commit as string | undefined,
        userToken,
      ),
    );
  });

  router.get('/component', async (req, res) => {
    const { componentName, projectName, namespaceName } = req.query;

    if (!componentName || !projectName || !namespaceName) {
      throw new InputError(
        'componentName, projectName and namespaceName are required query parameters',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await componentInfoService.fetchComponentDetails(
        namespaceName as string,
        projectName as string,
        componentName as string,
        userToken,
      ),
    );
  });

  router.patch('/component', requireAuth, async (req, res) => {
    const { componentName, projectName, namespaceName, autoDeploy } = req.body;

    if (!componentName || !projectName || !namespaceName) {
      throw new InputError(
        'componentName, projectName and namespaceName are required in request body',
      );
    }

    if (autoDeploy === undefined || typeof autoDeploy !== 'boolean') {
      throw new InputError('autoDeploy must be a boolean value');
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await componentInfoService.patchComponent(
        namespaceName as string,
        projectName as string,
        componentName as string,
        autoDeploy as boolean,
        userToken,
      ),
    );
  });

  router.get('/project', async (req, res) => {
    const { projectName, namespaceName } = req.query;

    if (!projectName || !namespaceName) {
      throw new InputError(
        'projectName and namespaceName are required query parameters',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await projectInfoService.fetchProjectDetails(
        namespaceName as string,
        projectName as string,
        userToken,
      ),
    );
  });

  router.get('/deployment-pipeline', async (req, res) => {
    const { projectName, namespaceName } = req.query;

    if (!projectName || !namespaceName) {
      throw new InputError(
        'projectName and namespaceName are required query parameters',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await projectInfoService.fetchProjectDeploymentPipeline(
        namespaceName as string,
        projectName as string,
        userToken,
      ),
    );
  });

  router.get('/build-logs', async (req, res) => {
    const { componentName, buildId, buildUuid, projectName, namespaceName } =
      req.query;

    if (!componentName || !buildId || !buildUuid) {
      throw new InputError(
        'componentName, buildId and buildUuid are required query parameters',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    try {
      const result = await buildInfoService.fetchBuildLogs(
        namespaceName as string,
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

  router.get('/workload', async (req, res) => {
    const { componentName, projectName, namespaceName } = req.query;

    if (!componentName || !projectName || !namespaceName) {
      throw new InputError(
        'componentName, projectName and namespaceName are required query parameters',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    try {
      const result = await workloadInfoService.fetchWorkloadInfo(
        {
          componentName: componentName as string,
          projectName: projectName as string,
          namespaceName: namespaceName as string,
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
    const { componentName, projectName, namespaceName } = req.query;
    const workloadSpec = req.body;

    if (!componentName || !projectName || !namespaceName) {
      throw new InputError(
        'componentName, projectName and namespaceName are required query parameters',
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
          namespaceName: namespaceName as string,
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
    const { componentName, projectName, namespaceName } = req.query;
    const { releaseName } = req.body;

    if (!componentName || !projectName || !namespaceName) {
      throw new InputError(
        'componentName, projectName and namespaceName are required query parameters',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await environmentInfoService.createComponentRelease(
        {
          componentName: componentName as string,
          projectName: projectName as string,
          namespaceName: namespaceName as string,
          releaseName: releaseName as string | undefined,
        },
        userToken,
      ),
    );
  });

  router.post('/deploy-release', requireAuth, async (req, res) => {
    const { componentName, projectName, namespaceName } = req.query;
    const { releaseName } = req.body;

    if (!componentName || !projectName || !namespaceName) {
      throw new InputError(
        'componentName, projectName and namespaceName are required query parameters',
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
          namespaceName: namespaceName as string,
          releaseName: releaseName as string,
        },
        userToken,
      ),
    );
  });

  router.get('/component-release-schema', async (req, res) => {
    const { componentName, projectName, namespaceName, releaseName } =
      req.query;

    if (!componentName || !projectName || !namespaceName || !releaseName) {
      throw new InputError(
        'componentName, projectName, namespaceName and releaseName are required query parameters',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await environmentInfoService.fetchComponentReleaseSchema(
        {
          componentName: componentName as string,
          projectName: projectName as string,
          namespaceName: namespaceName as string,
          releaseName: releaseName as string,
        },
        userToken,
      ),
    );
  });

  router.get('/release-bindings', async (req, res) => {
    const { componentName, projectName, namespaceName } = req.query;

    if (!componentName || !projectName || !namespaceName) {
      throw new InputError(
        'componentName, projectName and namespaceName are required query parameters',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await environmentInfoService.fetchReleaseBindings(
        {
          componentName: componentName as string,
          projectName: projectName as string,
          namespaceName: namespaceName as string,
        },
        userToken,
      ),
    );
  });

  router.patch('/patch-release-binding', requireAuth, async (req, res) => {
    const {
      componentName,
      projectName,
      namespaceName,
      environment,
      componentTypeEnvOverrides,
      traitOverrides,
      workloadOverrides,
      releaseName,
    } = req.body;

    if (!componentName || !projectName || !namespaceName || !environment) {
      throw new InputError(
        'componentName, projectName, namespaceName and environment are required in request body',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await environmentInfoService.patchReleaseBindingOverrides(
        {
          componentName: componentName as string,
          projectName: projectName as string,
          namespaceName: namespaceName as string,
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
    const { componentName, projectName, namespaceName, environmentName } =
      req.query;

    if (!componentName || !projectName || !namespaceName || !environmentName) {
      throw new InputError(
        'componentName, projectName, namespaceName and environmentName are required query parameters',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await environmentInfoService.fetchEnvironmentRelease(
        {
          componentName: componentName as string,
          projectName: projectName as string,
          namespaceName: namespaceName as string,
          environmentName: environmentName as string,
        },
        userToken,
      ),
    );
  });

  // Endpoint for listing secret references
  router.get('/secret-references', async (req, res) => {
    const { namespaceName } = req.query;

    if (!namespaceName) {
      throw new InputError('namespaceName is a required query parameter');
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await secretReferencesInfoService.fetchSecretReferences(
        namespaceName as string,
        userToken,
      ),
    );
  });

  // =====================
  // Git Secrets Endpoints
  // =====================

  // List git secrets for a namespace
  router.get('/git-secrets', async (req, res) => {
    const { namespaceName } = req.query;

    if (!namespaceName) {
      throw new InputError('namespaceName is a required query parameter');
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await gitSecretsService.listGitSecrets(
        namespaceName as string,
        userToken,
      ),
    );
  });

  // Create a new git secret
  router.post('/git-secrets', requireAuth, async (req, res) => {
    const { namespaceName } = req.query;
    const { secretName, secretType, token, sshKey } = req.body;

    if (!namespaceName) {
      throw new InputError('namespaceName is a required query parameter');
    }
    if (!secretName || !secretType) {
      throw new InputError(
        'secretName and secretType are required in the request body',
      );
    }
    if (secretType !== 'basic-auth' && secretType !== 'ssh-auth') {
      throw new InputError(
        'secretType must be either "basic-auth" or "ssh-auth"',
      );
    }
    if (secretType === 'basic-auth' && !token) {
      throw new InputError('token is required for basic-auth type');
    }
    if (secretType === 'ssh-auth' && !sshKey) {
      throw new InputError('sshKey is required for ssh-auth type');
    }

    const userToken = getUserTokenFromRequest(req);

    res
      .status(201)
      .json(
        await gitSecretsService.createGitSecret(
          namespaceName as string,
          secretName,
          secretType,
          token,
          sshKey,
          userToken,
        ),
      );
  });

  // Delete a git secret
  router.delete('/git-secrets/:secretName', requireAuth, async (req, res) => {
    const { namespaceName } = req.query;
    const { secretName } = req.params;

    if (!namespaceName) {
      throw new InputError('namespaceName is a required query parameter');
    }

    const userToken = getUserTokenFromRequest(req);

    await gitSecretsService.deleteGitSecret(
      namespaceName as string,
      secretName,
      userToken,
    );

    res.status(204).send();
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
    if (!mapping || !mapping.role.name || !mapping.entitlement) {
      throw new InputError(
        'Mapping must have role name and entitlement fields',
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
      if (!mapping || !mapping.role.name || !mapping.entitlement) {
        throw new InputError(
          'Mapping must have role name and entitlement fields',
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

  // Namespaces
  router.get('/namespaces', async (req, res) => {
    const userToken = getUserTokenFromRequest(req);
    res.json(await authzService.listNamespaces(userToken));
  });

  // Projects (for a given namespace)
  router.get('/namespaces/:namespaceName/projects', async (req, res) => {
    const { namespaceName } = req.params;
    const userToken = getUserTokenFromRequest(req);
    res.json(await authzService.listProjects(namespaceName, userToken));
  });

  // Components (for a given namespace and project)
  router.get(
    '/namespaces/:namespaceName/projects/:projectName/components',
    async (req, res) => {
      const { namespaceName, projectName } = req.params;
      const userToken = getUserTokenFromRequest(req);
      res.json(
        await authzService.listComponents(
          namespaceName,
          projectName,
          userToken,
        ),
      );
    },
  );

  // Delete a component
  router.delete(
    '/namespaces/:namespaceName/projects/:projectName/components/:componentName',
    requireAuth,
    async (req, res) => {
      const { namespaceName, projectName, componentName } = req.params;
      const userToken = getUserTokenFromRequest(req);

      // Delete the component in OpenChoreo (marks for deletion)
      await componentInfoService.deleteComponent(
        namespaceName,
        projectName,
        componentName,
        userToken,
      );

      logger.info(
        `Component ${componentName} marked for deletion in OpenChoreo`,
      );

      // Return 204 No Content - the frontend uses localStorage for immediate UI feedback
      // The next catalog sync will remove the entity from the catalog
      res.status(204).send();
    },
  );

  // Delete a project
  router.delete(
    '/namespaces/:namespaceName/projects/:projectName',
    requireAuth,
    async (req, res) => {
      const { namespaceName, projectName } = req.params;
      const userToken = getUserTokenFromRequest(req);
      await projectInfoService.deleteProject(
        namespaceName,
        projectName,
        userToken,
      );

      logger.info(`Project ${projectName} marked for deletion in OpenChoreo`);

      // Return 204 No Content - the frontend uses localStorage for immediate UI feedback
      // The next catalog sync will remove the entity from the catalog
      res.status(204).send();
    },
  );

  // DataPlane endpoint
  router.get('/dataplanes/:dpName', async (req, res) => {
    const { dpName } = req.params;
    const { namespaceName } = req.query;

    if (!namespaceName) {
      throw new InputError('namespaceName is a required query parameter');
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await dataPlaneInfoService.fetchDataPlaneDetails(
        {
          namespaceName: namespaceName as string,
          dataplaneName: dpName,
        },
        userToken,
      ),
    );
  });

  return router;
}
