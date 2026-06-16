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
import {
  SignInPageBlueprint,
  TranslationBlueprint,
} from '@backstage/plugin-app-react';
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
import { LogRowActionBlueprint } from '@openchoreo/backstage-plugin-openchoreo-observability/alpha';
import { InvestigateLogButton } from '@openchoreo/backstage-plugin-openchoreo-portal-assistant';
import { EntityCardBlueprint } from '@backstage/plugin-catalog-react/alpha';
import type { Entity } from '@backstage/catalog-model';

/**
 * Override `catalog-graph`'s default `api:catalog-graph` to include the
 * custom OpenChoreo relations (deploysTo, hostedOn, instanceOf, …). Without
 * this, custom relations don't render in entity Relations cards or the
 * catalog graph.
 */
export const catalogGraphPluginAlpha =
  catalogGraphPluginAlphaBase.withOverrides({
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
  });

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
                  clusterworkflow: PlayCircleOutlineIcon,
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
 * App-scoped extensions:
 * - SignInPage: lazy-loaded DynamicSignInPage that switches between
 *   OpenChoreo OIDC and guest mode based on `openchoreo.features.auth.enabled`.
 *   Replaces the legacy `createApp.components.SignInPage` slot.
 * - Translation overrides for catalog-import that previously rode via
 *   `createApp.__experimentalTranslations`. Customizes the header strings to
 *   read "Register an existing catalog entity" rather than the upstream
 *   default "Register Software".
 */
export const customAppModule = createFrontendModule({
  pluginId: 'app',
  extensions: [
    SignInPageBlueprint.make({
      params: {
        loader: () =>
          import('../components/DynamicSignInPage').then(m => m.default),
      },
    }),
    TranslationBlueprint.make({
      name: 'catalog-import-overrides',
      params: {
        resource: createTranslationMessages({
          ref: catalogImportTranslationRef,
          full: false,
          messages: {
            'defaultImportPage.headerTitle':
              'Register an existing catalog entity',
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
    // Host-injected per-row action renderer for the observability
    // runtime-logs tables. Wires the portal-assistant's
    // InvestigateLogButton into ObservabilityRuntimeLogs /
    // ObservabilityProjectRuntimeLogs without coupling the
    // observability plugin to portal-assistant. Mirrors upstream's
    // FormDecoratorBlueprint registration pattern.
    LogRowActionBlueprint.make({
      name: 'investigate-log',
      params: {
        renderer: (log, getLogsSnapshot) => (
          <InvestigateLogButton log={log} getLogsSnapshot={getLogsSnapshot} />
        ),
      },
    }),
    // OpenChoreoAboutCard sits in the Overview "info" slot on every
    // OpenChoreo-relevant entity kind. Lives in `packages/app` (not in
    // the openchoreo plugin) because the About card is the host's
    // composition of upstream's About metadata + OpenChoreo-specific
    // edit affordances — a host concern, not a plugin one.
    EntityCardBlueprint.make({
      name: 'openchoreo-about',
      params: {
        type: 'info',
        filter: (entity: Entity) =>
          [
            'component',
            'system',
            'domain',
            'resource',
            'environment',
            'dataplane',
            'clusterdataplane',
            'workflowplane',
            'clusterworkflowplane',
            'observabilityplane',
            'clusterobservabilityplane',
            'deploymentpipeline',
            'componenttype',
            'resourcetype',
            'clustercomponenttype',
            'clusterresourcetype',
            'traittype',
            'clustertraittype',
            'workflow',
            'clusterworkflow',
            'componentworkflow',
          ].includes(entity.kind.toLowerCase()),
        loader: () =>
          import('../components/catalog/OpenChoreoAboutCard').then(m => (
            <m.OpenChoreoAboutCard variant="gridItem" showEditIcon />
          )),
      },
    }),
    // CI status card — internally branches between the OpenChoreo
    // WorkflowsOverviewCard and an external-CI card (Jenkins / GitHub
    // Actions / GitLab) based on the entity's CI annotation. Component
    // pages only.
    EntityCardBlueprint.make({
      name: 'workflows-or-external-ci',
      params: {
        filter: 'kind:component',
        loader: () =>
          import('../components/catalog/WorkflowsOrExternalCICard').then(m => (
            <m.WorkflowsOrExternalCICard />
          )),
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
