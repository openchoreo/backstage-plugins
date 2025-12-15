import { createBackendModule } from '@backstage/backend-plugin-api';
import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node/alpha';
import { coreServices } from '@backstage/backend-plugin-api';
import { createProjectAction } from './actions/project';
import { createComponentAction } from './actions/component';
import { immediateCatalogServiceRef } from '@openchoreo/backstage-plugin-catalog-backend-module';
import { openChoreoTokenServiceRef } from '@openchoreo/openchoreo-auth';

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
        openChoreoToken: openChoreoTokenServiceRef,
      },
      async init({
        scaffolderActions,
        config,
        discovery,
        immediateCatalog,
        openChoreoToken,
      }) {
        scaffolderActions.addActions(
          createProjectAction(config, openChoreoToken),
          createComponentAction(
            config,
            discovery,
            immediateCatalog,
            openChoreoToken,
          ),
        );
      },
    });
  },
});
