import { createBackendFeatureLoader } from '@backstage/backend-plugin-api';
import { OpenChoreoAuthModule } from '@openchoreo/backstage-plugin-auth-backend-module-openchoreo-auth';
import {
  immediateCatalogServiceFactory,
  annotationStoreFactory,
} from '@openchoreo/backstage-plugin-catalog-backend-module';

/**
 * OpenChoreo service factories, registered ahead of every plugin: the catalog
 * module and openchoreo-backend depend on these (the AnnotationStore is
 * initialized by the catalog module). Exported for tests — consume
 * {@link portalBackendFeatures} instead.
 *
 * @internal
 */
export const portalServiceFactories = [
  immediateCatalogServiceFactory,
  annotationStoreFactory,
];

/**
 * The portal's plugin/module composition, in registration order, as lazy
 * import thunks. Exported for tests — consume {@link portalBackendFeatures}
 * instead.
 *
 * @internal
 */
export const portalFeatureLoaders = [
  () => import('@backstage/plugin-app-backend'),
  () => import('@backstage/plugin-proxy-backend'),
  () => import('@backstage/plugin-scaffolder-backend'),
  () => import('@backstage/plugin-scaffolder-backend-module-github'),
  () => import('@backstage/plugin-techdocs-backend'),

  // auth plugin
  // See https://backstage.io/docs/backend-system/building-backends/migrating#the-auth-plugin
  () => import('@backstage/plugin-auth-backend'),
  // Auth providers - both registered, but each checks config to determine if it should activate
  // OpenChoreo Auth provider - works with any OIDC-compliant IDP (active when openchoreo.features.auth.enabled = true)
  () => OpenChoreoAuthModule,
  // Guest provider for development/demo mode (active when openchoreo.features.auth.enabled = false)
  () => import('@backstage/plugin-auth-backend-module-guest-provider'),
  // Github provider
  () => import('@backstage/plugin-auth-backend-module-github-provider'),
  // events plugin — receives webhook POSTs and publishes to EventsService
  () => import('@backstage/plugin-events-backend'),

  // catalog plugin
  () => import('@backstage/plugin-catalog-backend'),
  () =>
    import('@backstage/plugin-catalog-backend-module-scaffolder-entity-model'),
  // See https://backstage.io/docs/features/software-catalog/configuration#subscribing-to-catalog-errors
  () => import('@backstage/plugin-catalog-backend-module-logs'),

  // permission plugin
  () => import('@backstage/plugin-permission-backend'),
  // OpenChoreo permission policy - handles openchoreo.* permissions via /authz/profile API
  // Falls back to ALLOW for non-OpenChoreo permissions (composable with other policies)
  () =>
    import(
      '@openchoreo/backstage-plugin-permission-backend-module-openchoreo-policy'
    ),

  // search plugin, engine and collators
  // See https://backstage.io/docs/features/search/search-engines
  () => import('@backstage/plugin-search-backend'),
  () => import('@backstage/plugin-search-backend-module-pg'),
  () => import('@backstage/plugin-search-backend-module-catalog'),

  // user settings plugin - enables centralized storage for starred entities and user preferences
  () => import('@backstage/plugin-user-settings-backend'),

  // IMPORTANT: catalog-backend-module MUST be registered before openchoreo-backend
  // because openchoreo-backend depends on the AnnotationStore which is initialized
  // by the catalog module.
  () => import('@openchoreo/backstage-plugin-catalog-backend-module'),
  () => import('@openchoreo/backstage-plugin-backend'),
  () => import('@openchoreo/backstage-plugin-scaffolder-backend-module'),
  () =>
    import(
      '@openchoreo/backstage-plugin-catalog-backend-module-openchoreo-users'
    ),
  () => import('@openchoreo/backstage-plugin-platform-engineer-core-backend'),
  () => import('@openchoreo/backstage-plugin-openchoreo-observability-backend'),
  () => import('@openchoreo/backstage-plugin-openchoreo-ci-backend'),

  // External CI Platform Integrations
  // Jenkins: Handles missing config gracefully (API calls fail, not startup)
  () => import('@backstage-community/plugin-jenkins-backend'),

  () => import('@openchoreo/backstage-plugin-openchoreo-workflows-backend'),
];

/**
 * The OpenChoreo Portal's backend composition as a single feature.
 *
 * Bundles every backend plugin, module, and service factory the stock portal
 * runs — Backstage core plugins (app, auth, catalog, scaffolder, search,
 * techdocs, permission, events, proxy, user-settings), the Jenkins CI
 * integration, and all OpenChoreo backend plugins and modules. Add it to a
 * backend with a single `backend.add(portalBackendFeatures)`; additional
 * features can still be added alongside it with further `backend.add(...)`
 * calls.
 *
 * Note: the portal's root HTTP router middleware is intentionally NOT part of
 * this bundle — add {@link portalRootHttpRouterServiceFactory} separately so
 * hosts can substitute their own root router configuration.
 *
 * @public
 */
export const portalBackendFeatures = createBackendFeatureLoader({
  *loader() {
    yield* portalServiceFactories;

    for (const load of portalFeatureLoaders) {
      yield load();
    }
  },
});
