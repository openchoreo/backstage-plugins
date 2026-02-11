import { createBackendModule } from '@backstage/backend-plugin-api';
import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node/alpha';
import { coreServices } from '@backstage/backend-plugin-api';
import { createProjectAction } from './actions/project';
import { createComponentAction } from './actions/component';
import {
  immediateCatalogServiceRef,
  annotationStoreRef,
} from '@openchoreo/backstage-plugin-catalog-backend-module';
import { createComponentTypeDefinitionAction } from './actions/componentType';
import { createTraitDefinitionAction } from './actions/trait';
import { createComponentWorkflowDefinitionAction } from './actions/componentWorkflow';
import { createEnvironmentAction } from './actions/environment';
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
          createProjectAction(config),
          createComponentAction(
            config,
            discovery,
            immediateCatalog,
            annotationStore,
          ),
          createComponentTypeDefinitionAction(config),
          createTraitDefinitionAction(config),
          createComponentWorkflowDefinitionAction(config),
          createEnvironmentAction(config),
        );
      },
    });
  },
});
