import {
  ApiBlueprint,
  configApiRef,
  createFrontendModule,
  discoveryApiRef,
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
import { OpenChoreoPermissionApi } from './api/OpenChoreoPermissionApi';

// pluginId: 'app' so the extension ID matches `api:app/plugin.permission.api`
// and overrides it — otherwise API_FACTORY_CONFLICT.
//
// `core.fetch` is deliberately NOT overridden: replacing it would strip the
// host's own fetch middleware (`plugin://` resolution, identity injection
// scoped to the host's backend) for every plugin in the app, and would attach
// OpenChoreo credentials to unrelated requests. OpenChoreo-bound calls use
// `openChoreoFetchApiRef` instead, which decorates the host's fetch API.

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
    openChoreoPermissionApi,
    openChoreoQueryWrapper,
    ...themeExtensions,
  ],
});
