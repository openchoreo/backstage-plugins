import {
  ScmIntegrationsApi,
  scmIntegrationsApiRef,
  ScmAuth,
} from '@backstage/integration-react';
import {
  AnyApiFactory,
  configApiRef,
  createApiFactory,
  discoveryApiRef,
  oauthRequestApiRef,
  errorApiRef,
  identityApiRef,
  fetchApiRef,
  storageApiRef,
} from '@backstage/core-plugin-api';
import { OAuth2 } from '@backstage/core-app-api';
import { VisitsWebStorageApi, visitsApiRef } from '@backstage/plugin-home';

// No explicit default theme id is seeded into localStorage. Backstage's
// user-settings panel renders a built-in Auto button that picks the first
// registered dark or light theme based on the OS `prefers-color-scheme`
// preference, which is exactly the behavior we want for new users.
import { UserSettingsStorage } from '@backstage/plugin-user-settings';
import { permissionApiRef } from '@backstage/plugin-permission-react';
import { OpenChoreoFetchApi } from './apis/OpenChoreoFetchApi';
import { OpenChoreoPermissionApi } from './apis/OpenChoreoPermissionApi';
// Import from separate file to avoid circular dependency with form decorators
import { openChoreoAuthApiRef } from './apis/authRefs';
// NOTE: ``perchAgentApiRef`` is also declared on
// ``openchoreoPerchPlugin.apis`` in plugins/openchoreo-portal-assistant/src/plugin.ts.
// That declaration is NOT picked up by the app at runtime because the plugin
// exports plain React components — it never registers a routable or
// component extension, so Backstage's plugin loader never visits its
// ``apis`` array. The app-level factory below is the one actually wired in;
// removing it causes ``NotImplementedError: No implementation available for
// apiRef{plugin.openchoreo-portal-assistant.service}`` in AssistantDrawerProvider.
import {
  perchAgentApiRef,
  PerchAgentClient,
} from '@openchoreo/backstage-plugin-openchoreo-portal-assistant';
// Re-export for use by App.tsx and other components
export { openChoreoAuthApiRef };

export const apis: AnyApiFactory[] = [
  createApiFactory({
    api: scmIntegrationsApiRef,
    deps: { configApi: configApiRef },
    factory: ({ configApi }) => ScmIntegrationsApi.fromConfig(configApi),
  }),
  ScmAuth.createDefaultApiFactory(),

  // Custom PermissionApi that injects IDP token for OpenChoreo authorization
  // This is needed because Backstage's default PermissionClient doesn't allow
  // custom headers to be injected (it uses cross-fetch directly)
  createApiFactory({
    api: permissionApiRef,
    deps: {
      configApi: configApiRef,
      discoveryApi: discoveryApiRef,
      identityApi: identityApiRef,
      oauthApi: openChoreoAuthApiRef,
    },
    factory: ({ configApi, discoveryApi, identityApi, oauthApi }) =>
      new OpenChoreoPermissionApi({
        config: configApi,
        discovery: discoveryApi,
        identity: identityApi,
        oauthApi,
      }),
  }),

  // Custom FetchApi that automatically injects auth tokens
  // This wraps all fetch calls to include Backstage token + IDP token
  // When openchoreo.features.auth.enabled is false, IDP token injection is skipped
  createApiFactory({
    api: fetchApiRef,
    deps: {
      identityApi: identityApiRef,
      oauthApi: openChoreoAuthApiRef,
      configApi: configApiRef,
    },
    factory: ({ identityApi, oauthApi, configApi }) =>
      new OpenChoreoFetchApi(identityApi, oauthApi, configApi),
  }),

  // OpenChoreo Auth provider - works with any OIDC-compliant IDP
  createApiFactory({
    api: openChoreoAuthApiRef,
    deps: {
      discoveryApi: discoveryApiRef,
      oauthRequestApi: oauthRequestApiRef,
      configApi: configApiRef,
    },
    factory: ({ discoveryApi, oauthRequestApi, configApi }) =>
      OAuth2.create({
        discoveryApi,
        oauthRequestApi,
        configApi,
        provider: {
          id: 'openchoreo-auth',
          title: 'OpenChoreo',
          icon: () => null,
        },
        environment: configApi.getOptionalString('auth.environment'),
        defaultScopes: ['openid', 'profile', 'email'],
      }),
  }),
  createApiFactory({
    api: visitsApiRef,
    deps: {
      identityApi: identityApiRef,
      errorApi: errorApiRef,
    },
    factory: ({ identityApi, errorApi }) =>
      VisitsWebStorageApi.create({ identityApi, errorApi }),
  }),
  // User settings storage - enables centralized storage for starred entities and preferences
  createApiFactory({
    api: storageApiRef,
    deps: {
      discoveryApi: discoveryApiRef,
      errorApi: errorApiRef,
      fetchApi: fetchApiRef,
      identityApi: identityApiRef,
    },
    factory: deps => UserSettingsStorage.create(deps),
  }),

  // DEFERRED to Step 3c: Scaffolder form decorators that inject the user's
  // OpenChoreo token as a secret (used by scaffolder actions for user-based
  // authorization). Under NFS this collides with the scaffolder plugin's
  // own default factory (API_FACTORY_CONFLICT). Will reinstate via
  // scaffolderPlugin.withOverrides so it lives under pluginId `scaffolder`.

  // openChoreoCiClientApiRef and genericWorkflowsClientApiRef are now
  // provided by their respective NFS plugins via `ApiBlueprint` (see
  // plugins/openchoreo-ci/src/alpha.tsx and
  // plugins/openchoreo-workflows/src/alpha.tsx). Registering them here
  // would collide with the plugin-scoped factories under NFS.

  // DEFERRED to Step 3c: Catalog graph API override with custom OpenChoreo
  // relations. The legacy `app`-scoped registration of `catalogGraphApiRef`
  // collides with `@backstage/plugin-catalog-graph`'s own default factory
  // under NFS (API_FACTORY_CONFLICT). The proper fix is a plugin override
  // (catalogGraphPlugin.withOverrides) that disables the upstream default
  // and provides our augmented one under the same pluginId. Until then,
  // custom relations (deploysTo, hostedOn, instanceOf, …) won't render in
  // entity Relations cards or the catalog graph.

  // Assistant Agent client (Perch). Mirrors the registration on
  // openchoreoPerchPlugin.apis — see the import-site comment for why
  // both exist.
  createApiFactory({
    api: perchAgentApiRef,
    deps: {
      discoveryApi: discoveryApiRef,
      fetchApi: fetchApiRef,
    },
    factory: ({ discoveryApi, fetchApi }) =>
      new PerchAgentClient({ discoveryApi, fetchApi }),
  }),

  // DEFERRED to Step 3c: Custom EntityPresentationApi with kind icons for
  // Environment, DataPlane, DeploymentPipeline, etc. Same conflict shape as
  // catalogGraphApiRef above — the override needs to come from a catalog
  // plugin module so it sits under pluginId `catalog`, not `app`. Until
  // then, those kinds get the default upstream icon in the catalog graph.
];
