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
  ApiRef,
  createApiRef,
  errorApiRef,
  identityApiRef,
  fetchApiRef,
  storageApiRef,
  OAuthApi,
} from '@backstage/core-plugin-api';
import { OAuth2 } from '@backstage/core-app-api';
import { VisitsWebStorageApi, visitsApiRef } from '@backstage/plugin-home';
import { UserSettingsStorage } from '@backstage/plugin-user-settings';
import { permissionApiRef } from '@backstage/plugin-permission-react';
import { OpenChoreoFetchApi } from './apis/OpenChoreoFetchApi';
import { OpenChoreoPermissionApi } from './apis/OpenChoreoPermissionApi';

// API reference for default-idp OIDC provider
export const defaultIdpAuthApiRef: ApiRef<OAuthApi> = createApiRef({
  id: 'auth.default-idp',
});

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
      oauthApi: defaultIdpAuthApiRef,
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
      oauthApi: defaultIdpAuthApiRef,
      configApi: configApiRef,
    },
    factory: ({ identityApi, oauthApi, configApi }) =>
      new OpenChoreoFetchApi(identityApi, oauthApi, configApi),
  }),

  // Default IDP OIDC Auth provider
  createApiFactory({
    api: defaultIdpAuthApiRef,
    deps: {
      discoveryApi: discoveryApiRef,
      oauthRequestApi: oauthRequestApiRef,
      configApi: configApiRef,
    },
    factory: ({ discoveryApi, oauthRequestApi, configApi }) =>
      OAuth2.create({
        discoveryApi,
        oauthRequestApi,
        provider: {
          id: 'default-idp',
          title: 'OpenChoreo IDP',
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
];
