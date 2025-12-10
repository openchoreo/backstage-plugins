import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { createRouter } from './router';
import { catalogServiceRef } from '@backstage/plugin-catalog-node/alpha';
import { EnvironmentInfoService } from './services/EnvironmentService/EnvironmentInfoService';
import { CellDiagramInfoService } from './services/CellDiagramService/CellDiagramInfoService';
import { BuildInfoService } from './services/BuildService/BuildInfoService';
import { ComponentInfoService } from './services/ComponentService/ComponentInfoService';
import { ProjectInfoService } from './services/ProjectService/ProjectInfoService';
import { RuntimeLogsInfoService } from './services/RuntimeLogsService/RuntimeLogsService';
import { WorkloadInfoService } from './services/WorkloadService/WorkloadInfoService';
import { DashboardInfoService } from './services/DashboardService/DashboardInfoService';
import { TraitInfoService } from './services/TraitService/TraitInfoService';
import { WorkflowSchemaService } from './services/WorkflowService/WorkflowSchemaService';
import { SecretReferencesService } from './services/SecretReferencesService/SecretReferencesService';
import { openChoreoTokenServiceRef } from '@openchoreo/openchoreo-auth';

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
        discovery: coreServices.discovery,
        config: coreServices.rootConfig,
        tokenService: openChoreoTokenServiceRef,
      },
      async init({ logger, config, httpRouter, tokenService }) {
        const openchoreoConfig = config.getOptionalConfig('openchoreo');

        if (!openchoreoConfig) {
          logger.info('OpenChoreo plugin disabled - no configuration found');
          return;
        }

        const baseUrl = openchoreoConfig.getString('baseUrl');

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

        const runtimeLogsInfoService = new RuntimeLogsInfoService(
          logger,
          baseUrl,
        );

        const workloadInfoService = new WorkloadInfoService(logger, baseUrl);

        const dashboardInfoService = new DashboardInfoService(logger, baseUrl);

        const traitInfoService = new TraitInfoService(logger, baseUrl);

        const workflowSchemaService = new WorkflowSchemaService(
          logger,
          baseUrl,
        );

        const secretReferencesInfoService = new SecretReferencesService(
          logger,
          baseUrl,
        );

        httpRouter.use(
          await createRouter({
            environmentInfoService,
            cellDiagramInfoService,
            buildInfoService,
            componentInfoService,
            projectInfoService,
            runtimeLogsInfoService,
            workloadInfoService,
            dashboardInfoService,
            traitInfoService,
            workflowSchemaService,
            secretReferencesInfoService,
            tokenService,
          }),
        );
      },
    });
  },
});
