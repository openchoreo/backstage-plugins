/*
 * Hi!
 *
 * Note that this is an EXAMPLE Backstage backend. Please check the README.
 *
 * Happy hacking!
 */

import { createBackend } from '@backstage/backend-defaults';
import {
  portalBackendFeatures,
  portalRootHttpRouterServiceFactory,
} from '@openchoreo/backstage-portal-backend';

const backend = createBackend();

// Root HTTP router with the IDP token header middleware — reads the IDP token
// from headers and makes it available to ALL routes via AsyncLocalStorage,
// which is critical for the permission system to access the user's IDP token
// when making authorization decisions.
backend.add(portalRootHttpRouterServiceFactory);

// The full portal backend composition: Backstage core plugins, the Jenkins CI
// integration, and all OpenChoreo backend plugins, modules, and service
// factories.
backend.add(portalBackendFeatures);

// External CI Platform Integrations
// GitLab: Requires integrations.gitlab config at startup. Uncomment after configuring in app-config.local.yaml
// For production, config is in app-config.production.yaml with Helm-injected env vars
// backend.add(import('@immobiliarelabs/backstage-plugin-gitlab-backend'));

// Portal Assistant backend — forwards Portal Assistant frontend traffic to the
// portal-assistant service in the OpenChoreo control plane. Plugin
// self-disables when openchoreo.portalAssistantUrl is not set.
// (Private package — deliberately not part of the published portal bundle.)
backend.add(
  import('@openchoreo/backstage-plugin-openchoreo-portal-assistant-backend'),
);

backend.start();
