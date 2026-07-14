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
  SwappableComponentBlueprint,
  TranslationBlueprint,
} from '@backstage/plugin-app-react';
import { Progress } from '@backstage/frontend-plugin-api';
import { PageLoader } from '@openchoreo/backstage-design-system';
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
import { FormDecoratorBlueprint } from '@backstage/plugin-scaffolder-react/alpha';
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
import { KIND_ICONS } from '../kindIcons';
import { openChoreoTokenDecorator } from '../scaffolder/openChoreoTokenDecorator';
import { LogRowActionBlueprint } from '@openchoreo/backstage-plugin-openchoreo-observability/alpha';
import { InvestigateLogButton } from '@openchoreo/backstage-plugin-openchoreo-portal-assistant';

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
 *
 * Also overrides `page:catalog` so /catalog renders the host's
 * `CustomCatalogPage` (kind-grouped picker + card grid layout) instead of
 * upstream's `DefaultCatalogPage`. Before the createApp feature reorder
 * landed, the legacy `<Route path="/catalog">` mount won; under the
 * reorder, upstream's NFS extension wins by default — so we override its
 * loader explicitly.
 *
 * Finally, overrides `page:catalog/entity` so the entity page rides through
 * our `OpenChoreoCatalogEntityPage` (which sets up `AsyncEntityProvider` +
 * `EntityLayoutWithDelete` wrapping `OpenChoreoEntityLayout` with the
 * dropdown-driven `CompactEntityHeader` and styled tab bar). The hand-
 * authored per-kind layouts in `entityPage` (Overview Grid, custom
 * EntityCatalogGraphCard, FailedBuildSnackbar, etc.) are rendered as
 * `<EntityLayout.Route>` children — `OpenChoreoEntityLayout` accepts the
 * same data key, so the legacy JSX slots in unchanged.
 *
 * NFS-contributed `EntityContentBlueprint`s (in `inputs.contents`) are
 * NOT mounted here because every tab the portal needs is already declared
 * by `entityPage`. If a future third-party plugin contributes a tab via
 * `EntityContentBlueprint`, switch this loader to a
 * `factory(originalFactory, { inputs })` form and merge `inputs.contents`
 * deduped by path.
 */
export const catalogPluginAlpha = catalogPluginAlphaBase.withOverrides({
  extensions: [
    catalogPluginAlphaBase.getExtension('page:catalog').override({
      params: {
        // `noHeader: true` suppresses the NFS `PageLayout`'s built-in title
        // bar ("Catalog" link). The host's `CustomCatalogPage` mounts its own
        // `<PageWithHeader title="Catalog">`; without this we render two
        // page headers, one above the other.
        noHeader: true,
        loader: () =>
          import('../components/catalog/CustomCatalogPage').then(m => (
            <m.CustomCatalogPage initialKind="system" />
          )),
      },
    }),
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
                kindIcons: KIND_ICONS,
              }),
          }),
      }),
    catalogPluginAlphaBase.getExtension('page:catalog/entity').override({
      params: {
        loader: async () => {
          const [{ OpenChoreoCatalogEntityPage }, { entityPage }] =
            await Promise.all([
              import('../components/catalog/OpenChoreoCatalogEntityPage'),
              import('../components/catalog/EntityPage'),
            ]);
          return (
            <OpenChoreoCatalogEntityPage>
              {entityPage}
            </OpenChoreoCatalogEntityPage>
          );
        },
      },
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
    // Swap Backstage's built-in `<Progress />` bar (the Suspense fallback
    // `ExtensionBoundary` renders while a lazy page/extension chunk loads) for
    // our centered PageLoader, so route transitions match the rest of the app.
    SwappableComponentBlueprint.make({
      name: 'progress',
      params: defineParams =>
        defineParams({
          component: Progress,
          loader: () => () => <PageLoader />,
        }),
    }),
  ],
});

export const scaffolderPluginAlpha = scaffolderPluginAlphaBase.withOverrides({
  extensions: [
    // Override `page:scaffolder`'s loader to render the host's
    // `<ScaffolderPage>` composition (CustomTemplateListPage,
    // CustomReviewStep, and 27 field extensions). Same reason as the
    // `page:catalog` override above: the createApp feature reorder lets
    // upstream's NFS scaffolder page win by default, which would drop
    // every host customization.
    scaffolderPluginAlphaBase.getExtension('page:scaffolder').override({
      params: {
        // Same `noHeader: true` reason as the `page:catalog` override above
        // — `OpenChoreoScaffolderPage` mounts a `<ScaffolderPage
        // headerOptions={{ title: 'Create a new resource', ... }}>` that
        // renders its own page header.
        noHeader: true,
        loader: () =>
          import('../components/scaffolder/OpenChoreoScaffolderPage').then(
            m => <m.OpenChoreoScaffolderPage />,
          ),
      },
    }),
    // Inject the OpenChoreo IDP-token decorator alongside any other
    // FormDecoratorBlueprint extensions plugins may contribute. The
    // earlier shape (`params: defineParams => defineParams({ factory: () => create({decorators: [openChoreoTokenDecorator]}) })`)
    // discarded `inputs.formDecorators`, silently dropping every other
    // plugin's decorator. Using `factory(originalFactory, { inputs })`
    // preserves the upstream accumulation and then concats ours.
    scaffolderPluginAlphaBase
      .getExtension('api:scaffolder/form-decorators')
      .override({
        factory(originalFactory, { inputs }) {
          const contributed = inputs.formDecorators.map(e =>
            e.get(FormDecoratorBlueprint.dataRefs.formDecoratorLoader),
          );
          return originalFactory({
            params: defineParams =>
              defineParams({
                api: formDecoratorsApiRef,
                deps: {},
                factory: () =>
                  DefaultScaffolderFormDecoratorsApi.create({
                    decorators: [openChoreoTokenDecorator, ...contributed],
                  }),
              }),
          });
        },
      }),
  ],
});
