/*
 * Hi!
 *
 * Note that this is an EXAMPLE Backstage backend. Please check the README.
 *
 * Happy hacking!
 */

import { createBackend } from '@backstage/backend-defaults';
// Import the incremental entity provider to enable burst-based ingestion of OpenChoreo entities
import { catalogModuleOpenchoreoIncrementalProvider } from '@openchoreo/plugin-catalog-backend-module-openchoreo-incremental';

const backend = createBackend();

backend.add(import('@backstage/plugin-app-backend'));
backend.add(import('@backstage/plugin-proxy-backend'));
backend.add(import('@backstage/plugin-scaffolder-backend'));
backend.add(import('@backstage/plugin-scaffolder-backend-module-github'));
backend.add(import('@backstage/plugin-techdocs-backend'));

// auth plugin
backend.add(import('@backstage/plugin-auth-backend'));
// See https://backstage.io/docs/backend-system/building-backends/migrating#the-auth-plugin
backend.add(import('@backstage/plugin-auth-backend-module-guest-provider'));
// See https://backstage.io/docs/auth/guest/provider

// catalog plugin
backend.add(import('@backstage/plugin-catalog-backend'));
backend.add(
  import('@backstage/plugin-catalog-backend-module-scaffolder-entity-model'),
);

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

backend.add(import('@openchoreo/backstage-plugin-backend'));
// Deprecated: Old catalog backend module replaced by incremental provider for better scalability
// backend.add(import('@openchoreo/backstage-plugin-catalog-backend-module')); // Removed: migrated to incremental provider
backend.add(import('@openchoreo/backstage-plugin-scaffolder-backend-module'));
// Initialize the incremental ingestion module that manages entity provider lifecycle
backend.add(
  import('@openchoreo/plugin-catalog-backend-module-openchoreo-incremental'),
);
// Register the incremental entity provider with the backend for scheduled ingestion
backend.add(catalogModuleOpenchoreoIncrementalProvider);
backend.start();
