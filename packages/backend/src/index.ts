/*
 * Hi!
 *
 * Note that this is an EXAMPLE Backstage backend. Please check the README.
 *
 * Happy hacking!
 */

import { createBackend } from '@backstage/backend-defaults';
import { OpenChoreoAuthModule } from '@openchoreo/backstage-plugin-auth-backend-module-openchoreo-auth';
import { rootHttpRouterServiceFactory } from '@backstage/backend-defaults/rootHttpRouter';
import {
  immediateCatalogServiceFactory,
  annotationStoreFactory,
} from '@openchoreo/backstage-plugin-catalog-backend-module';
import { createIdpTokenHeaderMiddleware } from '@openchoreo/openchoreo-auth';

const backend = createBackend();

// Configure root HTTP router with IDP token header middleware
// This middleware reads the IDP token from headers and makes it available
// to ALL routes via AsyncLocalStorage, which is critical for the permission
// system to access the user's IDP token when making authorization decisions.
backend.add(
  rootHttpRouterServiceFactory({
    configure: ({ app, applyDefaults, middleware }) => {
      // Apply standard middleware first
      app.use(middleware.helmet());
      app.use(middleware.cors());
      app.use(middleware.compression());
      app.use(middleware.logging());

      // IDP token middleware - reads token from header and establishes
      // AsyncLocalStorage context so getUserTokenFromContext() works everywhere
      app.use(createIdpTokenHeaderMiddleware());

      // Apply remaining defaults (routes, error handling, etc.)
      applyDefaults();
    },
  }),
);
backend.add(immediateCatalogServiceFactory);
backend.add(annotationStoreFactory);

backend.add(import('@backstage/plugin-app-backend'));
backend.add(import('@backstage/plugin-proxy-backend'));
backend.add(import('@backstage/plugin-scaffolder-backend'));
backend.add(import('@backstage/plugin-scaffolder-backend-module-github'));
backend.add(import('@backstage/plugin-techdocs-backend'));

// auth plugin
backend.add(import('@backstage/plugin-auth-backend'));
// See https://backstage.io/docs/backend-system/building-backends/migrating#the-auth-plugin

// Auth providers - both registered, but each checks config to determine if it should activate
// OpenChoreo Auth provider - works with any OIDC-compliant IDP (active when openchoreo.features.auth.enabled = true)
backend.add(OpenChoreoAuthModule);
// Guest provider for development/demo mode (active when openchoreo.features.auth.enabled = false)
backend.add(import('@backstage/plugin-auth-backend-module-guest-provider'));
// Github provider
backend.add(import('@backstage/plugin-auth-backend-module-github-provider'));
// catalog plugin
backend.add(import('@backstage/plugin-catalog-backend'));
backend.add(
  import('@backstage/plugin-catalog-backend-module-scaffolder-entity-model'),
);

// See https://backstage.io/docs/features/software-catalog/configuration#subscribing-to-catalog-errors
backend.add(import('@backstage/plugin-catalog-backend-module-logs'));

// permission plugin
backend.add(import('@backstage/plugin-permission-backend'));
// OpenChoreo permission policy - handles openchoreo.* permissions via /authz/profile API
// Falls back to ALLOW for non-OpenChoreo permissions (composable with other policies)
backend.add(
  import(
    '@openchoreo/backstage-plugin-permission-backend-module-openchoreo-policy'
  ),
);

// search plugin
backend.add(import('@backstage/plugin-search-backend'));

// search engine
// See https://backstage.io/docs/features/search/search-engines
backend.add(import('@backstage/plugin-search-backend-module-pg'));

// search collators
backend.add(import('@backstage/plugin-search-backend-module-catalog'));
backend.add(import('@backstage/plugin-search-backend-module-techdocs'));

// user settings plugin - enables centralized storage for starred entities and user preferences
backend.add(import('@backstage/plugin-user-settings-backend'));

// IMPORTANT: catalog-backend-module MUST be registered before openchoreo-backend
// because openchoreo-backend depends on the AnnotationStore which is initialized
// by the catalog module.
backend.add(import('@openchoreo/backstage-plugin-catalog-backend-module'));
backend.add(import('@openchoreo/backstage-plugin-backend'));
backend.add(import('@openchoreo/backstage-plugin-scaffolder-backend-module'));
backend.add(
  import(
    '@openchoreo/backstage-plugin-catalog-backend-module-openchoreo-users'
  ),
);
backend.add(
  import('@openchoreo/backstage-plugin-platform-engineer-core-backend'),
);
// backend.add(import('@openchoreo/backstage-plugin-home-backend'));
backend.add(
  import('@openchoreo/backstage-plugin-openchoreo-observability-backend'),
);
backend.add(import('@openchoreo/backstage-plugin-openchoreo-ci-backend'));

// External CI Platform Integrations
// Jenkins: Handles missing config gracefully (API calls fail, not startup)
backend.add(import('@backstage-community/plugin-jenkins-backend'));
// GitLab: Requires integrations.gitlab config at startup. Uncomment after configuring in app-config.local.yaml
// For production, config is in app-config.production.yaml with Helm-injected env vars
// backend.add(import('@immobiliarelabs/backstage-plugin-gitlab-backend'));

backend.add(import('@openchoreo/backstage-plugin-openchoreo-workflows-backend'));
backend.start();
