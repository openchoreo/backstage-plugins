import { createBackendModule } from '@backstage/backend-plugin-api';
import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node';
import { coreServices } from '@backstage/backend-plugin-api';
import { createProjectAction } from './actions/project';
import { createComponentAction } from './actions/component';
import {
  immediateCatalogServiceRef,
  annotationStoreRef,
} from '@openchoreo/backstage-plugin-catalog-backend-module';
import { createComponentTypeDefinitionAction } from './actions/componentType';
import { createResourceTypeDefinitionAction } from './actions/resourceType';
import { createProjectTypeDefinitionAction } from './actions/projectType';
import { createResourceAction } from './actions/resource';
import { createTraitDefinitionAction } from './actions/trait';
import { createComponentWorkflowDefinitionAction } from './actions/componentWorkflow';
import { createClusterComponentTypeDefinitionAction } from './actions/clusterComponentType';
import { createClusterResourceTypeDefinitionAction } from './actions/clusterResourceType';
import { createClusterProjectTypeDefinitionAction } from './actions/clusterProjectType';
import { createClusterTraitDefinitionAction } from './actions/clusterTrait';
import { createClusterWorkflowDefinitionAction } from './actions/clusterWorkflow';
import { createEnvironmentAction } from './actions/environment';
import { createNotificationChannelAction } from './actions/notificationChannel';
import { createNamespaceAction } from './actions/namespace';
import { createDeploymentPipelineAction } from './actions/deploymentPipeline';
/**
 * A backend module that registers the actions into the scaffolder
 */
export const scaffolderModule = createBackendModule({
  moduleId: 'openchoreo-scaffolder-actions',
  pluginId: 'scaffolder',
  register({ registerInit }) {
    registerInit({
      deps: {
        scaffolderActions: scaffolderActionsExtensionPoint,
        config: coreServices.rootConfig,
        discovery: coreServices.discovery,
        immediateCatalog: immediateCatalogServiceRef,
        annotationStore: annotationStoreRef,
      },
      async init({
        scaffolderActions,
        config,
        discovery,
        immediateCatalog,
        annotationStore,
      }) {
        scaffolderActions.addActions(
          createProjectAction(config, immediateCatalog),
          createComponentAction(
            config,
            discovery,
            immediateCatalog,
            annotationStore,
          ),
          createComponentTypeDefinitionAction(config, immediateCatalog),
          createResourceTypeDefinitionAction(config, immediateCatalog),
          createProjectTypeDefinitionAction(config, immediateCatalog),
          createResourceAction(config, immediateCatalog),
          createTraitDefinitionAction(config, immediateCatalog),
          createComponentWorkflowDefinitionAction(config, immediateCatalog),
          createEnvironmentAction(config, immediateCatalog),
          createNotificationChannelAction(config, immediateCatalog),
          createNamespaceAction(config, immediateCatalog),
          createClusterComponentTypeDefinitionAction(config, immediateCatalog),
          createClusterResourceTypeDefinitionAction(config, immediateCatalog),
          createClusterProjectTypeDefinitionAction(config, immediateCatalog),
          createClusterTraitDefinitionAction(config, immediateCatalog),
          createClusterWorkflowDefinitionAction(config, immediateCatalog),
          createDeploymentPipelineAction(config, immediateCatalog),
        );
      },
    });
  },
});
