import {
  ApiBlueprint,
  configApiRef,
  createFrontendModule,
  discoveryApiRef,
  fetchApiRef,
  identityApiRef,
} from '@backstage/frontend-plugin-api';
import {
  AppRootWrapperBlueprint,
  ThemeBlueprint,
} from '@backstage/plugin-app-react';
import { permissionApiRef } from '@backstage/plugin-permission-react';
import { appThemes } from '@openchoreo/backstage-design-system';
import { OpenChoreoQueryProvider } from '@openchoreo/backstage-plugin-react';
import { openChoreoAuthApiRef } from './api/authRefs';
import { OpenChoreoFetchApi } from './api/OpenChoreoFetchApi';
import { OpenChoreoPermissionApi } from './api/OpenChoreoPermissionApi';

// pluginId: 'app' so extension IDs match `api:app/core.fetch` /
// `api:app/plugin.permission.api` and override them — otherwise
// API_FACTORY_CONFLICT.
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

// App-root query provider so trees rendered outside this plugin's scope
// (e.g. openChoreoEntityPageOverride under pluginId 'catalog') still see a
// QueryClient. AppRootWrapperBlueprint only accepts app-plugin modules.
const openChoreoQueryWrapper = AppRootWrapperBlueprint.make({
  name: 'openchoreo-query',
  params: { component: OpenChoreoQueryProvider },
});

// The OpenChoreo light/dark themes, so a host app that installs this plugin
// renders OpenChoreo surfaces with the palette they were designed against
// instead of the stock Backstage one. Additive: the host's own themes stay in
// the picker, and either of these can be turned off through `app.extensions`.
// They also carry `app.branding.theme.*.primaryColor` (see `config.d.ts` in
// the design system), which is why the themes ship here rather than staying
// private to the portal.
const themeExtensions = appThemes.map(theme =>
  ThemeBlueprint.make({
    name: theme.id,
    params: { theme },
  }),
);

export const openChoreoAppModule = createFrontendModule({
  pluginId: 'app',
  extensions: [
    openChoreoFetchApi,
    openChoreoPermissionApi,
    openChoreoQueryWrapper,
    ...themeExtensions,
  ],
});
