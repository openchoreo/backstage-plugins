/**
 * Step 3c — plugin-scoped overrides for upstream NFS plugin APIs we customize.
 *
 * Under NFS, registering a custom API factory under our `app` plugin id
 * collides with the upstream plugin that already owns that API id
 * (API_FACTORY_CONFLICT). Instead, override the existing extension under the
 * upstream plugin's own pluginId via `withOverrides({ extensions: [...] })`.
 */

import catalogGraphPluginAlphaBase from '@backstage/plugin-catalog-graph/alpha';
import catalogPluginAlphaBase from '@backstage/plugin-catalog/alpha';
import scaffolderPluginAlphaBase from '@backstage/plugin-scaffolder/alpha';
import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { createTranslationMessages } from '@backstage/frontend-plugin-api';
import { TranslationBlueprint } from '@backstage/plugin-app-react';
import { catalogImportTranslationRef } from '@backstage/plugin-catalog-import/alpha';
import {
  catalogGraphApiRef,
  DefaultCatalogGraphApi,
  ALL_RELATIONS,
  ALL_RELATION_PAIRS,
} from '@backstage/plugin-catalog-graph';
import {
  catalogApiRef,
  entityPresentationApiRef,
} from '@backstage/plugin-catalog-react';
import { DefaultEntityPresentationApi } from '@backstage/plugin-catalog';
import {
  formDecoratorsApiRef,
  DefaultScaffolderFormDecoratorsApi,
} from '@backstage/plugin-scaffolder/alpha';
import {
  RELATION_DEPLOYS_TO,
  RELATION_DEPLOYED_BY,
  RELATION_USES_PIPELINE,
  RELATION_PIPELINE_USED_BY,
  RELATION_HOSTED_ON,
  RELATION_HOSTS,
  RELATION_OBSERVED_BY,
  RELATION_OBSERVES,
  RELATION_INSTANCE_OF,
  RELATION_HAS_INSTANCE,
  RELATION_USES_WORKFLOW,
  RELATION_WORKFLOW_USED_BY,
  RELATION_BUILDS_ON,
  RELATION_BUILDS,
} from '@openchoreo/backstage-plugin-common';
import CloudIcon from '@material-ui/icons/Cloud';
import DnsIcon from '@material-ui/icons/Dns';
import AccountTreeIcon from '@material-ui/icons/AccountTree';
import VisibilityIcon from '@material-ui/icons/Visibility';
import BuildIcon from '@material-ui/icons/Build';
import CategoryIcon from '@material-ui/icons/Category';
import LayersIcon from '@material-ui/icons/Layers';
import StorageIcon from '@material-ui/icons/Storage';
import ExtensionIcon from '@material-ui/icons/Extension';
import PlayCircleOutlineIcon from '@material-ui/icons/PlayCircleOutline';
import SettingsApplicationsIcon from '@material-ui/icons/SettingsApplications';
import { openChoreoTokenDecorator } from '../scaffolder/openChoreoTokenDecorator';

/**
 * Override `catalog-graph`'s default `api:catalog-graph` to include the
 * custom OpenChoreo relations (deploysTo, hostedOn, instanceOf, …). Without
 * this, custom relations don't render in entity Relations cards or the
 * catalog graph.
 */
export const catalogGraphPluginAlpha = catalogGraphPluginAlphaBase.withOverrides(
  {
    extensions: [
      catalogGraphPluginAlphaBase.getExtension('api:catalog-graph').override({
        params: defineParams =>
          defineParams({
            api: catalogGraphApiRef,
            deps: {},
            factory: () =>
              new DefaultCatalogGraphApi({
                knownRelations: [
                  ...ALL_RELATIONS,
                  RELATION_DEPLOYS_TO,
                  RELATION_DEPLOYED_BY,
                  RELATION_USES_PIPELINE,
                  RELATION_PIPELINE_USED_BY,
                  RELATION_HOSTED_ON,
                  RELATION_HOSTS,
                  RELATION_OBSERVED_BY,
                  RELATION_OBSERVES,
                  RELATION_INSTANCE_OF,
                  RELATION_HAS_INSTANCE,
                  RELATION_USES_WORKFLOW,
                  RELATION_WORKFLOW_USED_BY,
                  RELATION_BUILDS_ON,
                  RELATION_BUILDS,
                ],
                knownRelationPairs: [
                  ...ALL_RELATION_PAIRS,
                  [RELATION_DEPLOYS_TO, RELATION_DEPLOYED_BY],
                  [RELATION_USES_PIPELINE, RELATION_PIPELINE_USED_BY],
                  [RELATION_HOSTED_ON, RELATION_HOSTS],
                  [RELATION_OBSERVED_BY, RELATION_OBSERVES],
                  [RELATION_INSTANCE_OF, RELATION_HAS_INSTANCE],
                  [RELATION_USES_WORKFLOW, RELATION_WORKFLOW_USED_BY],
                  [RELATION_BUILDS_ON, RELATION_BUILDS],
                ],
                defaultRelationTypes: { exclude: [] },
              }),
          }),
      }),
    ],
  },
);

/**
 * Override `catalog`'s default `api:catalog/entity-presentation` to provide
 * kind icons for OpenChoreo-specific entity kinds (Environment, DataPlane,
 * DeploymentPipeline, etc.) in the catalog graph and entity views.
 */
export const catalogPluginAlpha = catalogPluginAlphaBase.withOverrides({
  extensions: [
    catalogPluginAlphaBase
      .getExtension('api:catalog/entity-presentation')
      .override({
        params: defineParams =>
          defineParams({
            api: entityPresentationApiRef,
            deps: { catalogApi: catalogApiRef },
            factory: ({ catalogApi }) =>
              DefaultEntityPresentationApi.create({
                catalogApi,
                kindIcons: {
                  environment: CloudIcon,
                  dataplane: DnsIcon,
                  clusterdataplane: DnsIcon,
                  deploymentpipeline: AccountTreeIcon,
                  observabilityplane: VisibilityIcon,
                  clusterobservabilityplane: VisibilityIcon,
                  workflowplane: BuildIcon,
                  clusterworkflowplane: BuildIcon,
                  componenttype: CategoryIcon,
                  clustercomponenttype: CategoryIcon,
                  resourcetype: LayersIcon,
                  clusterresourcetype: LayersIcon,
                  resource: StorageIcon,
                  traittype: ExtensionIcon,
                  clustertraittype: ExtensionIcon,
                  workflow: PlayCircleOutlineIcon,
                  componentworkflow: SettingsApplicationsIcon,
                },
              }),
          }),
      }),
  ],
});

/**
 * Override `scaffolder`'s default `page:scaffolder` (disabled — the legacy
 * `<ScaffolderPage>` mount at `/create` wins) and
 * `api:scaffolder/form-decorators` to inject the user's OpenChoreo token as
 * a secret for user-based authorization in scaffolder actions.
 */
/**
 * App-scoped translation overrides that previously rode in via
 * `createApp.__experimentalTranslations`. The catalog-import header strings
 * are customized to read "Register an existing catalog entity" rather than
 * the upstream default "Register Software".
 */
export const customTranslationsModule = createFrontendModule({
  pluginId: 'app',
  extensions: [
    TranslationBlueprint.make({
      name: 'catalog-import-overrides',
      params: {
        resource: createTranslationMessages({
          ref: catalogImportTranslationRef,
          full: false,
          messages: {
            'defaultImportPage.headerTitle': 'Register an existing catalog entity',
            'defaultImportPage.contentHeaderTitle':
              'Start tracking your entity in {{appTitle}}',
            'defaultImportPage.supportTitle':
              'Start tracking your entity in {{appTitle}} by adding it to the software catalog.',
            'importInfoCard.title': 'Register an existing catalog entity',
            'stepInitAnalyzeUrl.urlHelperText':
              'Enter the full path to your entity file to start tracking',
            'stepFinishImportLocation.locations.viewButtonText': 'View Entity',
          },
        }),
      },
    }),
  ],
});

export const scaffolderPluginAlpha = scaffolderPluginAlphaBase.withOverrides({
  extensions: [
    scaffolderPluginAlphaBase
      .getExtension('page:scaffolder')
      .override({ disabled: true }),
    scaffolderPluginAlphaBase
      .getExtension('api:scaffolder/form-decorators')
      .override({
        params: defineParams =>
          defineParams({
            api: formDecoratorsApiRef,
            deps: {},
            factory: () =>
              DefaultScaffolderFormDecoratorsApi.create({
                decorators: [openChoreoTokenDecorator],
              }),
          }),
      }),
  ],
});
