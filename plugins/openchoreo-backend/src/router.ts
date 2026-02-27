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
import { ClusterTraitInfoService } from './services/ClusterTraitService/ClusterTraitInfoService';
import { ClusterComponentTypeInfoService } from './services/ClusterComponentTypeService/ClusterComponentTypeInfoService';
import { PlatformResourceService } from './services/PlatformResourceService/PlatformResourceService';
import { AuthzService } from './services/AuthzService/AuthzService';
import { DataPlaneInfoService } from './services/DataPlaneService/DataPlaneInfoService';
import { ClusterDataPlaneInfoService } from './services/ClusterDataPlaneService/ClusterDataPlaneInfoService';
import {
  OpenChoreoTokenService,
  createUserTokenMiddleware,
  getUserTokenFromRequest,
  createRequireAuthMiddleware,
} from '@openchoreo/openchoreo-auth';
import type { AuthService, LoggerService } from '@backstage/backend-plugin-api';
import type { CatalogService } from '@backstage/plugin-catalog-node';
import type { AnnotationStore } from '@openchoreo/backstage-plugin-catalog-backend-module';

const CLUSTER_SCOPED_KINDS = [
  'clustercomponenttypes',
  'clustertraits',
  'clusterdataplanes',
  'clusterobservabilityplanes',
  'clusterbuildplanes',
] as const;

const VALID_PLATFORM_RESOURCE_KINDS = [
  'componenttypes',
  'traits',
  'workflows',
  'component-workflows',
  'environments',
  'dataplanes',
  'buildplanes',
  'observabilityplanes',
  'deploymentpipelines',
  ...CLUSTER_SCOPED_KINDS,
] as const;

export type PlatformResourceKind =
  (typeof VALID_PLATFORM_RESOURCE_KINDS)[number];

export async function createRouter({
  environmentInfoService,
  cellDiagramInfoService,
  buildInfoService,
  componentInfoService,
  projectInfoService,
  workloadInfoService,
  dashboardInfoService,
  traitInfoService,
  clusterTraitInfoService,
  clusterComponentTypeInfoService,
  secretReferencesInfoService,
  gitSecretsService,
  authzService,
  dataPlaneInfoService,
  clusterDataPlaneInfoService,
  platformResourceService,
  annotationStore,
  catalogService,
  auth,
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
  clusterTraitInfoService: ClusterTraitInfoService;
  clusterComponentTypeInfoService: ClusterComponentTypeInfoService;
  secretReferencesInfoService: SecretReferencesService;
  gitSecretsService: GitSecretsService;
  authzService: AuthzService;
  dataPlaneInfoService: DataPlaneInfoService;
  clusterDataPlaneInfoService: ClusterDataPlaneInfoService;
  platformResourceService: PlatformResourceService;
  annotationStore: AnnotationStore;
  catalogService: CatalogService;
  auth: AuthService;
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

  // Endpoint for listing cluster traits
  router.get('/cluster-traits', async (req, res) => {
    const userToken = getUserTokenFromRequest(req);
    res.json(await clusterTraitInfoService.fetchClusterTraits(userToken));
  });

  // Endpoint for fetching cluster trait schema
  router.get('/cluster-trait-schema', async (req, res) => {
    const { clusterTraitName } = req.query;

    if (!clusterTraitName) {
      throw new InputError('clusterTraitName is a required query parameter');
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await clusterTraitInfoService.fetchClusterTraitSchema(
        clusterTraitName as string,
        userToken,
      ),
    );
  });

  // Endpoint for listing cluster component types
  router.get('/cluster-component-types', async (req, res) => {
    const userToken = getUserTokenFromRequest(req);
    res.json(
      await clusterComponentTypeInfoService.fetchClusterComponentTypes(
        userToken,
      ),
    );
  });

  // Endpoint for fetching cluster component type schema
  router.get('/cluster-component-type-schema', async (req, res) => {
    const { cctName } = req.query;

    if (!cctName) {
      throw new InputError('cctName is a required query parameter');
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await clusterComponentTypeInfoService.fetchClusterComponentTypeSchema(
        cctName as string,
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

    const schema = await environmentInfoService.fetchComponentReleaseSchema(
      {
        componentName: componentName as string,
        projectName: projectName as string,
        namespaceName: namespaceName as string,
        releaseName: releaseName as string,
      },
      userToken,
    );
    res.json({
      success: true,
      data: schema,
      message: 'Schema fetched successfully',
    });
  });

  router.get('/release-bindings', async (req, res) => {
    const { componentName, projectName, namespaceName } = req.query;

    if (!componentName || !projectName || !namespaceName) {
      throw new InputError(
        'componentName, projectName and namespaceName are required query parameters',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    const bindings = await environmentInfoService.fetchReleaseBindings(
      {
        componentName: componentName as string,
        projectName: projectName as string,
        namespaceName: namespaceName as string,
      },
      userToken,
    );
    res.json({ success: true, data: bindings });
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

  router.get('/resources', async (req, res) => {
    const { componentName, projectName, namespaceName, environmentName } =
      req.query;

    if (!componentName || !projectName || !namespaceName || !environmentName) {
      throw new InputError(
        'componentName, projectName, namespaceName and environmentName are required query parameters',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await environmentInfoService.fetchResourceTree(
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

  router.get('/resource-events', requireAuth, async (req, res) => {
    const {
      componentName,
      projectName,
      namespaceName,
      environmentName,
      kind,
      name,
      namespace,
      uid,
    } = req.query;

    if (
      !componentName ||
      !projectName ||
      !namespaceName ||
      !environmentName ||
      !kind ||
      !name
    ) {
      throw new InputError(
        'componentName, projectName, namespaceName, environmentName, kind and name are required query parameters',
      );
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await environmentInfoService.fetchResourceEvents(
        {
          componentName: componentName as string,
          projectName: projectName as string,
          namespaceName: namespaceName as string,
          environmentName: environmentName as string,
          kind: kind as string,
          name: name as string,
          namespace: namespace as string | undefined,
          uid: uid as string | undefined,
        },
        userToken,
      ),
    );
  });

  router.get('/pod-logs', requireAuth, async (req, res) => {
    const {
      componentName,
      projectName,
      namespaceName,
      environmentName,
      name,
      namespace,
      container,
      sinceSeconds,
    } = req.query;
    if (
      !componentName ||
      !projectName ||
      !namespaceName ||
      !environmentName ||
      !name
    ) {
      throw new InputError(
        'componentName, projectName, namespaceName, environmentName and name are required query parameters',
      );
    }
    const userToken = getUserTokenFromRequest(req);
    let sinceSecondsValue: number | undefined;
    if (sinceSeconds !== undefined) {
      const parsed = Number(sinceSeconds);
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw new InputError('sinceSeconds must be a non-negative number');
      }
      sinceSecondsValue = Math.floor(parsed);
    }
    res.json(
      await environmentInfoService.fetchPodLogs(
        {
          componentName: componentName as string,
          projectName: projectName as string,
          namespaceName: namespaceName as string,
          environmentName: environmentName as string,
          name: name as string,
          namespace: namespace as string | undefined,
          container: container as string | undefined,
          sinceSeconds: sinceSecondsValue,
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
    const { secretName, secretType, token, sshKey, username, sshKeyId } =
      req.body;

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
          username,
          sshKeyId,
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
  // Cluster & Namespace Scoped Authorization Endpoints
  // =====================

  // Cluster Roles
  router.get('/clusterroles', async (req, res) => {
    const userToken = getUserTokenFromRequest(req);
    res.json(await authzService.listClusterRoles(userToken));
  });

  router.get('/clusterroles/:name', async (req, res) => {
    const { name } = req.params;
    const userToken = getUserTokenFromRequest(req);
    res.json(await authzService.getClusterRole(name, userToken));
  });

  router.post('/clusterroles', requireAuth, async (req, res) => {
    const role = req.body;
    if (!role || !role.name || !role.actions) {
      throw new InputError('Cluster role must have name and actions fields');
    }
    const userToken = getUserTokenFromRequest(req);
    res.json(await authzService.createClusterRole(role, userToken));
  });

  router.put('/clusterroles/:name', requireAuth, async (req, res) => {
    const { name } = req.params;
    const role = req.body;
    if (!role || !role.actions) {
      throw new InputError('Request body must have actions field');
    }
    const userToken = getUserTokenFromRequest(req);
    res.json(await authzService.updateClusterRole(name, role, userToken));
  });

  router.delete('/clusterroles/:name', requireAuth, async (req, res) => {
    const { name } = req.params;
    const userToken = getUserTokenFromRequest(req);
    await authzService.deleteClusterRole(name, userToken);
    res.status(204).send();
  });

  // Namespace Roles
  router.get('/namespaces/:namespace/roles', async (req, res) => {
    const { namespace } = req.params;
    const userToken = getUserTokenFromRequest(req);
    res.json(await authzService.listNamespaceRoles(namespace, userToken));
  });

  router.get('/namespaces/:namespace/roles/:name', async (req, res) => {
    const { namespace, name } = req.params;
    const userToken = getUserTokenFromRequest(req);
    res.json(await authzService.getNamespaceRole(namespace, name, userToken));
  });

  router.post('/namespaces/:namespace/roles', requireAuth, async (req, res) => {
    const { namespace } = req.params;
    const role = req.body;
    if (!role || !role.name || !role.actions) {
      throw new InputError('Namespace role must have name and actions fields');
    }
    const userToken = getUserTokenFromRequest(req);
    res.json(
      await authzService.createNamespaceRole({ ...role, namespace }, userToken),
    );
  });

  router.put(
    '/namespaces/:namespace/roles/:name',
    requireAuth,
    async (req, res) => {
      const { namespace, name } = req.params;
      const role = req.body;
      if (!role || !role.actions) {
        throw new InputError('Request body must have actions field');
      }
      const userToken = getUserTokenFromRequest(req);
      res.json(
        await authzService.updateNamespaceRole(
          namespace,
          name,
          role,
          userToken,
        ),
      );
    },
  );

  router.delete(
    '/namespaces/:namespace/roles/:name',
    requireAuth,
    async (req, res) => {
      const { namespace, name } = req.params;
      const userToken = getUserTokenFromRequest(req);
      await authzService.deleteNamespaceRole(namespace, name, userToken);
      res.status(204).send();
    },
  );

  // Cluster Role Bindings
  router.get('/clusterrolebindings', async (req, res) => {
    const userToken = getUserTokenFromRequest(req);
    const filters = {
      roleName: req.query.roleName as string | undefined,
      claim: req.query.claim as string | undefined,
      value: req.query.value as string | undefined,
      effect: req.query.effect as 'allow' | 'deny' | undefined,
    };
    res.json(await authzService.listClusterRoleBindings(filters, userToken));
  });

  router.get('/clusterrolebindings/:name', async (req, res) => {
    const { name } = req.params;
    const userToken = getUserTokenFromRequest(req);
    res.json(await authzService.getClusterRoleBinding(name, userToken));
  });

  router.post('/clusterrolebindings', requireAuth, async (req, res) => {
    const binding = req.body;
    if (!binding || !binding.role || !binding.entitlement) {
      throw new InputError(
        'Cluster role binding must have role.name and entitlement fields',
      );
    }
    const userToken = getUserTokenFromRequest(req);
    res.json(await authzService.createClusterRoleBinding(binding, userToken));
  });

  router.put('/clusterrolebindings/:name', requireAuth, async (req, res) => {
    const { name } = req.params;
    const binding = req.body;
    if (!binding) {
      throw new InputError('Request body is required');
    }
    const userToken = getUserTokenFromRequest(req);
    res.json(
      await authzService.updateClusterRoleBinding(name, binding, userToken),
    );
  });

  router.delete('/clusterrolebindings/:name', requireAuth, async (req, res) => {
    const { name } = req.params;
    const userToken = getUserTokenFromRequest(req);
    await authzService.deleteClusterRoleBinding(name, userToken);
    res.status(204).send();
  });

  // Namespace Role Bindings
  router.get('/namespaces/:namespace/rolebindings', async (req, res) => {
    const { namespace } = req.params;
    const userToken = getUserTokenFromRequest(req);
    const filters = {
      roleName: req.query.roleName as string | undefined,
      roleNamespace: req.query.roleNamespace as string | undefined,
      claim: req.query.claim as string | undefined,
      value: req.query.value as string | undefined,
      effect: req.query.effect as 'allow' | 'deny' | undefined,
    };
    res.json(
      await authzService.listNamespaceRoleBindings(
        namespace,
        filters,
        userToken,
      ),
    );
  });

  router.get('/namespaces/:namespace/rolebindings/:name', async (req, res) => {
    const { namespace, name } = req.params;
    const userToken = getUserTokenFromRequest(req);
    res.json(
      await authzService.getNamespaceRoleBinding(namespace, name, userToken),
    );
  });

  router.post(
    '/namespaces/:namespace/rolebindings',
    requireAuth,
    async (req, res) => {
      const { namespace } = req.params;
      const binding = req.body;
      if (!binding || !binding.role?.name || !binding.entitlement) {
        throw new InputError(
          'Namespace role binding must have role.name and entitlement fields',
        );
      }
      const userToken = getUserTokenFromRequest(req);
      res.json(
        await authzService.createNamespaceRoleBinding(
          { ...binding, namespace },
          userToken,
        ),
      );
    },
  );

  router.put(
    '/namespaces/:namespace/rolebindings/:name',
    requireAuth,
    async (req, res) => {
      const { namespace, name } = req.params;
      const binding = req.body;
      if (!binding) {
        throw new InputError('Request body is required');
      }
      const userToken = getUserTokenFromRequest(req);
      res.json(
        await authzService.updateNamespaceRoleBinding(
          namespace,
          name,
          binding,
          userToken,
        ),
      );
    },
  );

  router.delete(
    '/namespaces/:namespace/rolebindings/:name',
    requireAuth,
    async (req, res) => {
      const { namespace, name } = req.params;
      const userToken = getUserTokenFromRequest(req);
      await authzService.deleteNamespaceRoleBinding(namespace, name, userToken);
      res.status(204).send();
    },
  );

  // =====================
  // Role Binding Lookup & Force-Delete Endpoints
  // =====================

  // List all bindings for a cluster role (includes NS-level bindings referencing it)
  router.get('/clusterroles/:name/bindings', async (req, res) => {
    const { name } = req.params;
    const userToken = getUserTokenFromRequest(req);
    res.json(
      await authzService.listBindingsForRole(
        name,
        'cluster',
        undefined,
        userToken,
      ),
    );
  });

  // List all bindings for a namespace role
  router.get(
    '/namespaces/:namespace/roles/:name/bindings',
    async (req, res) => {
      const { namespace, name } = req.params;
      const userToken = getUserTokenFromRequest(req);
      res.json(
        await authzService.listBindingsForRole(
          name,
          'namespace',
          namespace,
          userToken,
        ),
      );
    },
  );

  // Force-delete a cluster role (delete bindings first, then the role)
  router.post(
    '/clusterroles/:name/force-delete',
    requireAuth,
    async (req, res) => {
      const { name } = req.params;

      const userToken = getUserTokenFromRequest(req);
      res.json(await authzService.forceDeleteClusterRole(name, userToken));
    },
  );

  // Force-delete a namespace role (delete bindings first, then the role)
  router.post(
    '/namespaces/:namespace/roles/:name/force-delete',
    requireAuth,
    async (req, res) => {
      const { namespace, name } = req.params;

      const userToken = getUserTokenFromRequest(req);
      res.json(
        await authzService.forceDeleteNamespaceRole(namespace, name, userToken),
      );
    },
  );

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

  // === Custom Entity Annotations ===

  // Blocked annotation key prefixes (system-managed, not user-editable)
  const blockedAnnotationPrefixes = [
    'openchoreo.io/',
    'openchoreo.dev/',
    'backstage.io/managed-by-',
    'kubernetes.io/',
    'kubectl.kubernetes.io/',
  ];

  function isBlockedAnnotationKey(key: string): boolean {
    return blockedAnnotationPrefixes.some(prefix => key.startsWith(prefix));
  }

  // Get custom annotations for an entity
  router.get('/entity-annotations', async (req, res) => {
    const { entityRef } = req.query;

    if (!entityRef || typeof entityRef !== 'string') {
      throw new InputError('entityRef is a required query parameter');
    }

    const annotations = await annotationStore.getAnnotations(entityRef);

    res.json({ annotations });
  });

  // Update custom annotations for an entity
  router.patch('/entity-annotations', requireAuth, async (req, res) => {
    const { entityRef, annotations } = req.body;

    if (!entityRef || typeof entityRef !== 'string') {
      throw new InputError('entityRef is required in request body');
    }

    if (!annotations || typeof annotations !== 'object') {
      throw new InputError('annotations must be an object in request body');
    }

    // Validate annotation keys
    for (const key of Object.keys(annotations)) {
      if (isBlockedAnnotationKey(key)) {
        throw new InputError(
          `Annotation key "${key}" is system-managed and cannot be modified`,
        );
      }
    }

    await annotationStore.setAnnotations(
      entityRef,
      annotations as Record<string, string | null>,
    );

    // Trigger entity refresh so the processor re-applies annotations
    try {
      const credentials = await auth.getOwnServiceCredentials();
      await catalogService.refreshEntity(entityRef, { credentials });
    } catch (error) {
      logger.warn(
        `Failed to refresh entity ${entityRef} after annotation update: ${error}`,
      );
    }

    // Return the current annotations after update
    const updatedAnnotations = await annotationStore.getAnnotations(entityRef);

    res.json({ annotations: updatedAnnotations });
  });

  // DataPlane endpoints
  router.get('/dataplanes', async (req, res) => {
    const { namespaceName } = req.query;

    if (!namespaceName) {
      throw new InputError('namespaceName is a required query parameter');
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await dataPlaneInfoService.listDataPlanes(
        namespaceName as string,
        userToken,
      ),
    );
  });

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

  // ClusterDataPlane endpoints
  router.get('/cluster-dataplanes', async (req, res) => {
    const userToken = getUserTokenFromRequest(req);

    res.json(
      await clusterDataPlaneInfoService.listClusterDataPlanes(userToken),
    );
  });

  router.get('/cluster-dataplanes/:cdpName', async (req, res) => {
    const { cdpName } = req.params;
    const userToken = getUserTokenFromRequest(req);

    res.json(
      await clusterDataPlaneInfoService.fetchClusterDataPlaneDetails(
        { name: cdpName },
        userToken,
      ),
    );
  });

  // =====================
  // Platform Resource Definition Endpoints
  // =====================

  // Get full CRD definition for a platform resource
  router.get('/platform-resource/definition', async (req, res) => {
    const { kind, namespaceName, resourceName } = req.query;

    const isClusterScoped = CLUSTER_SCOPED_KINDS.includes(kind as any);

    if (!kind || !resourceName) {
      throw new InputError(
        'kind and resourceName are required query parameters',
      );
    }

    if (!isClusterScoped && !namespaceName) {
      throw new InputError(
        'namespaceName is required for namespace-scoped resources',
      );
    }

    if (!VALID_PLATFORM_RESOURCE_KINDS.includes(kind as any)) {
      throw new InputError(
        `kind must be one of: ${VALID_PLATFORM_RESOURCE_KINDS.join(', ')}`,
      );
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await platformResourceService.getResourceDefinition(
        kind as PlatformResourceKind,
        (namespaceName as string) || '',
        resourceName as string,
        userToken,
      ),
    );
  });

  // Update (or create) a platform resource definition
  router.put('/platform-resource/definition', requireAuth, async (req, res) => {
    const { kind, namespaceName, resourceName } = req.query;
    const { resource } = req.body;

    const isClusterScoped = CLUSTER_SCOPED_KINDS.includes(kind as any);

    if (!kind || !resourceName) {
      throw new InputError(
        'kind and resourceName are required query parameters',
      );
    }

    if (!isClusterScoped && !namespaceName) {
      throw new InputError(
        'namespaceName is required for namespace-scoped resources',
      );
    }

    if (!VALID_PLATFORM_RESOURCE_KINDS.includes(kind as any)) {
      throw new InputError(
        `kind must be one of: ${VALID_PLATFORM_RESOURCE_KINDS.join(', ')}`,
      );
    }

    if (!resource || typeof resource !== 'object') {
      throw new InputError('resource object is required in request body');
    }

    const userToken = getUserTokenFromRequest(req);

    res.json(
      await platformResourceService.updateResourceDefinition(
        kind as PlatformResourceKind,
        (namespaceName as string) || '',
        resourceName as string,
        resource as Record<string, unknown>,
        userToken,
      ),
    );
  });

  // Delete a platform resource definition
  router.delete(
    '/platform-resource/definition',
    requireAuth,
    async (req, res) => {
      const { kind, namespaceName, resourceName } = req.query;

      const isClusterScoped = CLUSTER_SCOPED_KINDS.includes(kind as any);

      if (!kind || !resourceName) {
        throw new InputError(
          'kind and resourceName are required query parameters',
        );
      }

      if (!isClusterScoped && !namespaceName) {
        throw new InputError(
          'namespaceName is required for namespace-scoped resources',
        );
      }

      if (!VALID_PLATFORM_RESOURCE_KINDS.includes(kind as any)) {
        throw new InputError(
          `kind must be one of: ${VALID_PLATFORM_RESOURCE_KINDS.join(', ')}`,
        );
      }

      const userToken = getUserTokenFromRequest(req);

      res.json(
        await platformResourceService.deleteResourceDefinition(
          kind as PlatformResourceKind,
          (namespaceName as string) || '',
          resourceName as string,
          userToken,
        ),
      );
    },
  );

  return router;
}
