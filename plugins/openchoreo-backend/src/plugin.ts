import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { createRouter } from './router';
import { catalogServiceRef } from '@backstage/plugin-catalog-node/alpha';
import { EnvironmentInfoService } from './services/EnvironmentService/EnvironmentInfoService';
import { CellDiagramInfoService } from './services/CellDiagramService/CellDiagramInfoService';
import { BuildTemplateInfoService } from './services/BuildTemplateService/BuildTemplateInfoService';
import { BuildInfoService } from './services/BuildService/BuildInfoService';
import { ComponentInfoService } from './services/ComponentService/ComponentInfoService';
import { ProjectInfoService } from './services/ProjectService/ProjectInfoService';
import { RuntimeLogsInfoService } from './services/RuntimeLogsService/RuntimeLogsService';
import { WorkloadInfoService } from './services/WorkloadService/WorkloadInfoService';
import { DashboardInfoService } from './services/DashboardService/DashboardInfoService';
import { AddonInfoService } from './services/AddonService/AddonInfoService';
import { WorkflowSchemaService } from './services/WorkflowService/WorkflowSchemaService';

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
      },
      async init({ logger, config, httpRouter }) {
        const openchoreoConfig = config.getOptionalConfig('openchoreo');

        if (!openchoreoConfig) {
          logger.info('OpenChoreo plugin disabled - no configuration found');
          return;
        }

        const environmentInfoService = new EnvironmentInfoService(
          logger,
          openchoreoConfig.get('baseUrl'),
          openchoreoConfig.getOptional('token'),
        );

        const cellDiagramInfoService = new CellDiagramInfoService(
          logger,
          openchoreoConfig.get('baseUrl'),
        );

        const buildTemplateInfoService = new BuildTemplateInfoService(
          logger,
          openchoreoConfig.get('baseUrl'),
        );

        const buildInfoService = new BuildInfoService(
          logger,
          openchoreoConfig.get('baseUrl'),
          openchoreoConfig.getOptional('token'),
        );

        const componentInfoService = new ComponentInfoService(
          logger,
          openchoreoConfig.get('baseUrl'),
          openchoreoConfig.getOptional('token'),
        );

        const projectInfoService = new ProjectInfoService(
          logger,
          openchoreoConfig.get('baseUrl'),
          openchoreoConfig.getOptional('token'),
        );

        const runtimeLogsInfoService = new RuntimeLogsInfoService(
          logger,
          openchoreoConfig.get('baseUrl'),
          openchoreoConfig.getOptional('token'),
        );

        const workloadInfoService = new WorkloadInfoService(
          logger,
          openchoreoConfig.get('baseUrl'),
          openchoreoConfig.getOptional('token'),
        );

        const dashboardInfoService = new DashboardInfoService(
          logger,
          openchoreoConfig.get('baseUrl'),
        );

        const addonInfoService = new AddonInfoService(
          logger,
          openchoreoConfig.get('baseUrl'),
        );

        const workflowSchemaService = new WorkflowSchemaService(
          logger,
          openchoreoConfig.get('baseUrl'),
        );

        httpRouter.use(
          await createRouter({
            environmentInfoService,
            cellDiagramInfoService,
            buildTemplateInfoService,
            buildInfoService,
            componentInfoService,
            projectInfoService,
            runtimeLogsInfoService,
            workloadInfoService,
            dashboardInfoService,
            addonInfoService,
            workflowSchemaService,
          }),
        );
      },
    });
  },
});
