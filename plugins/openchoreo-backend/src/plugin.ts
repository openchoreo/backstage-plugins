import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { createRouter } from './router';
import { catalogServiceRef } from '@backstage/plugin-catalog-node';
import { EnvironmentInfoService } from './services/EnvironmentService/EnvironmentInfoService';
import { CellDiagramInfoService } from './services/CellDiagramService/CellDiagramInfoService';
import { BuildInfoService } from './services/BuildService/BuildInfoService';
import { ComponentInfoService } from './services/ComponentService/ComponentInfoService';
import { ProjectInfoService } from './services/ProjectService/ProjectInfoService';
import { WorkloadInfoService } from './services/WorkloadService/WorkloadInfoService';
import { DashboardInfoService } from './services/DashboardService/DashboardInfoService';
import { TraitInfoService } from './services/TraitService/TraitInfoService';
import { ClusterTraitInfoService } from './services/ClusterTraitService/ClusterTraitInfoService';
import { ClusterComponentTypeInfoService } from './services/ClusterComponentTypeService/ClusterComponentTypeInfoService';
import { SecretReferencesService } from './services/SecretReferencesService/SecretReferencesService';
import { GitSecretsService } from './services/GitSecretsService/GitSecretsService';
import { AuthzService } from './services/AuthzService/AuthzService';
import { DataPlaneInfoService } from './services/DataPlaneService/DataPlaneInfoService';
import { ClusterDataPlaneInfoService } from './services/ClusterDataPlaneService/ClusterDataPlaneInfoService';
import { PlatformResourceService } from './services/PlatformResourceService/PlatformResourceService';
import { openChoreoTokenServiceRef } from '@openchoreo/openchoreo-auth';
import { openchoreoPermissions } from '@openchoreo/backstage-plugin-common';
import {
  matchesCapability,
  openchoreoComponentResourceRef,
} from '@openchoreo/backstage-plugin-permission-backend-module-openchoreo-policy';
import { annotationStoreRef } from '@openchoreo/backstage-plugin-catalog-backend-module';

/**
 * choreoPlugin backend plugin
 *
 * @public
 */
export const choreoPlugin = createBackendPlugin({
  pluginId: 'openchoreo',
  register(env) {
    env.registerInit({
      deps: {
        logger: coreServices.logger,
        auth: coreServices.auth,
        httpAuth: coreServices.httpAuth,
        httpRouter: coreServices.httpRouter,
        catalog: catalogServiceRef,
        permissions: coreServices.permissions,
        permissionsRegistry: coreServices.permissionsRegistry,
        discovery: coreServices.discovery,
        config: coreServices.rootConfig,
        tokenService: openChoreoTokenServiceRef,
        annotationStore: annotationStoreRef,
      },
      async init({
        logger,
        config,
        httpRouter,
        tokenService,
        catalog,
        permissionsRegistry,
        auth,
        annotationStore,
      }) {
        const openchoreoConfig = config.getOptionalConfig('openchoreo');

        if (!openchoreoConfig) {
          logger.info('OpenChoreo plugin disabled - no configuration found');
          return;
        }

        const baseUrl = openchoreoConfig.getString('baseUrl');

        // Check if auth feature is enabled (defaults to true)
        // When auth is enabled, mutating operations require a valid user token
        const authEnabled =
          config.getOptionalBoolean('openchoreo.features.auth.enabled') ?? true;

        // All services use user tokens forwarded from the frontend
        // No default token - services require token parameter for each API call
        const environmentInfoService = new EnvironmentInfoService(
          logger,
          baseUrl,
        );

        const cellDiagramInfoService = new CellDiagramInfoService(
          logger,
          baseUrl,
          config,
        );

        const buildInfoService = new BuildInfoService(logger, baseUrl);

        const componentInfoService = new ComponentInfoService(logger, baseUrl);

        const projectInfoService = new ProjectInfoService(logger, baseUrl);

        const workloadInfoService = new WorkloadInfoService(logger, baseUrl);

        const dashboardInfoService = new DashboardInfoService(logger, baseUrl);

        const traitInfoService = new TraitInfoService(logger, baseUrl);

        const clusterTraitInfoService = new ClusterTraitInfoService(
          logger,
          baseUrl,
        );

        const clusterComponentTypeInfoService =
          new ClusterComponentTypeInfoService(logger, baseUrl);

        const secretReferencesInfoService = new SecretReferencesService(
          logger,
          baseUrl,
        );

        const gitSecretsService = new GitSecretsService(logger, baseUrl);

        const authzService = new AuthzService(logger, baseUrl);

        const dataPlaneInfoService = new DataPlaneInfoService(logger, baseUrl);

        const clusterDataPlaneInfoService = new ClusterDataPlaneInfoService(
          logger,
          baseUrl,
        );

        const platformResourceService = new PlatformResourceService(
          logger,
          baseUrl,
        );

        // Register OpenChoreo component permissions with the permissions registry
        // This enables CONDITIONAL permission checks against catalog entities
        const componentPermissions = openchoreoPermissions.filter(
          p =>
            'resourceType' in p &&
            p.resourceType === openchoreoComponentResourceRef.resourceType,
        );

        permissionsRegistry.addResourceType({
          resourceRef: openchoreoComponentResourceRef,
          permissions: componentPermissions,
          rules: [matchesCapability],
          getResources: async (resourceRefs: string[]) => {
            try {
              // Get service credentials for catalog access
              const credentials = await auth.getOwnServiceCredentials();
              // Fetch entities by refs for permission rule evaluation
              const response = await catalog.getEntitiesByRefs(
                { entityRefs: resourceRefs },
                { credentials } as Parameters<
                  typeof catalog.getEntitiesByRefs
                >[1],
              );
              return response.items;
            } catch (error) {
              logger.error(
                `Failed to fetch entities for permission check`,
                error as Error,
              );
              return resourceRefs.map(() => undefined);
            }
          },
        });

        httpRouter.use(
          await createRouter({
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
            catalogService: catalog,
            auth,
            tokenService,
            authEnabled,
            logger,
          }),
        );
      },
    });
  },
});
