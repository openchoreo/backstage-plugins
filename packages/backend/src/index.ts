/*
 * Hi!
 *
 * Note that this is an EXAMPLE Backstage backend. Please check the README.
 *
 * Happy hacking!
 */

import { createBackend } from '@backstage/backend-defaults';
import { OpenChoreoDefaultAuthModule } from '@openchoreo/backstage-plugin-auth-backend-module-openchoreo-default';
import { rootHttpRouterServiceFactory } from '@backstage/backend-defaults/rootHttpRouter';
import { immediateCatalogServiceFactory } from '@openchoreo/backstage-plugin-catalog-backend-module';

/**
 * OPTIONAL: For large-scale deployments, use the incremental ingestion module
 *
 * ----------------------------------------------------------------------
 * INCREMENTAL INGESTION: STEP 1 of 3
 * ----------------------------------------------------------------------
 */
// UNCOMMENT this import line below.
// import { catalogModuleOpenchoreoIncrementalProvider } from '@openchoreo/plugin-catalog-backend-module-openchoreo-incremental';

const backend = createBackend();

backend.add(rootHttpRouterServiceFactory());
backend.add(immediateCatalogServiceFactory);

backend.add(import('@backstage/plugin-app-backend'));
backend.add(import('@backstage/plugin-proxy-backend'));
backend.add(import('@backstage/plugin-scaffolder-backend'));
backend.add(import('@backstage/plugin-scaffolder-backend-module-github'));
backend.add(import('@backstage/plugin-techdocs-backend'));

// auth plugin
backend.add(import('@backstage/plugin-auth-backend'));
// See https://backstage.io/docs/backend-system/building-backends/migrating#the-auth-plugin

// Auth providers - both registered, but each checks config to determine if it should activate
// OpenChoreo Default IDP OAuth provider (active when openchoreo.features.auth.enabled = true)
backend.add(OpenChoreoDefaultAuthModule);
// Guest provider for development/demo mode (active when openchoreo.features.auth.enabled = false)
backend.add(import('@backstage/plugin-auth-backend-module-guest-provider'));

/**
 * ----------------------------------------------------------------------
 * INCREMENTAL INGESTION: STEP 2 of 3
 * ----------------------------------------------------------------------
 *
 * If enabling Incremental Ingestion:
 * 1. COMMENT OUT the Standard Catalog line below.
 * 2. DO NOT comment out the 'scaffolder-entity-model' line.
 */

// Standard Catalog (Comment this line out for Incremental Ingestion)
backend.add(import('@backstage/plugin-catalog-backend'));

// Scaffolder Entity Model (Keep this active in both modes)
backend.add(
  import('@backstage/plugin-catalog-backend-module-scaffolder-entity-model'),
);

/**
 * ----------------------------------------------------------------------
 * INCREMENTAL INGESTION: STEP 3 of 3
 * ----------------------------------------------------------------------
 *
 *  Note: You must also update app-config.yaml to use:
 * 'openchoreo.incremental' instead of 'openchoreo.schedule'
 */

// UNCOMMENT the block below..
// backend.add(
//   import('@openchoreo/plugin-catalog-backend-module-openchoreo-incremental'),
// );
// backend.add(catalogModuleOpenchoreoIncrementalProvider);

// See https://backstage.io/docs/features/software-catalog/configuration#subscribing-to-catalog-errors
backend.add(import('@backstage/plugin-catalog-backend-module-logs'));

// permission plugin
backend.add(import('@backstage/plugin-permission-backend'));
// See https://backstage.io/docs/permissions/getting-started for how to create your own permission policy
backend.add(
  import('@backstage/plugin-permission-backend-module-allow-all-policy'),
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

backend.add(import('@openchoreo/backstage-plugin-backend'));
backend.add(import('@openchoreo/backstage-plugin-catalog-backend-module'));
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
backend.start();
