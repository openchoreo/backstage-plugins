import {
  ApiBlueprint,
  configApiRef,
  createFrontendModule,
  discoveryApiRef,
  fetchApiRef,
  identityApiRef,
} from '@backstage/frontend-plugin-api';
import { permissionApiRef } from '@backstage/plugin-permission-react';
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

export const openChoreoAppModule = createFrontendModule({
  pluginId: 'app',
  extensions: [openChoreoFetchApi, openChoreoPermissionApi],
});
