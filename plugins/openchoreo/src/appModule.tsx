import {
  ApiBlueprint,
  configApiRef,
  createFrontendModule,
  discoveryApiRef,
  fetchApiRef,
  identityApiRef,
} from '@backstage/frontend-plugin-api';
import { AppRootWrapperBlueprint } from '@backstage/plugin-app-react';
import { permissionApiRef } from '@backstage/plugin-permission-react';
import { OpenChoreoQueryProvider } from '@openchoreo/backstage-plugin-react';
import { openChoreoAuthApiRef } from './api/authRefs';
import { OpenChoreoFetchApi } from './api/OpenChoreoFetchApi';
import { OpenChoreoPermissionApi } from './api/OpenChoreoPermissionApi';

// Attached to pluginId 'app' so extension IDs match Backstage's default
// api extensions (api:app/core.fetch, api:app/plugin.permission.api) and
// override them. Registering these under pluginId 'openchoreo' would
// trigger API_FACTORY_CONFLICT at app startup.
const openChoreoFetchApi = ApiBlueprint.make({
  name: fetchApiRef.id,
  params: defineParams =>
    defineParams({
      api: fetchApiRef,
      deps: {
        identityApi: identityApiRef,
        oauthApi: openChoreoAuthApiRef,
        configApi: configApiRef,
      },
      factory: ({ identityApi, oauthApi, configApi }) =>
        new OpenChoreoFetchApi(identityApi, oauthApi, configApi),
    }),
});

const openChoreoPermissionApi = ApiBlueprint.make({
  name: permissionApiRef.id,
  params: defineParams =>
    defineParams({
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
});

// Wrap the entire app root in the shared TanStack QueryClientProvider so
// any React tree rendered outside this plugin's own scope (notably
// openChoreoEntityPageOverride, which mounts under pluginId 'catalog') can
// still call useQuery / useOpenChoreoQuery. PluginWrapperBlueprint alone
// (used in alpha.tsx) only covers this plugin's own extensions.
//
// AppRootWrapperBlueprint's `app/root` input is `internal: true` and only
// accepts contributions from a module of the 'app' plugin — hence why this
// lives here in openChoreoAppModule and not in the plugin itself.
const openChoreoQueryWrapper = AppRootWrapperBlueprint.make({
  name: 'openchoreo-query',
  params: { component: OpenChoreoQueryProvider },
});

export const openChoreoAppModule = createFrontendModule({
  pluginId: 'app',
  extensions: [
    openChoreoFetchApi,
    openChoreoPermissionApi,
    openChoreoQueryWrapper,
  ],
});
