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
import { OpenChoreoFetchApi } from './apis/OpenChoreoFetchApi';

// API reference for OpenChoreo IDP OIDC provider
export const openChoreoIdpAuthApiRef: ApiRef<OAuthApi> = createApiRef({
  id: 'auth.openchoreo-idp',
});

export const apis: AnyApiFactory[] = [
  createApiFactory({
    api: scmIntegrationsApiRef,
    deps: { configApi: configApiRef },
    factory: ({ configApi }) => ScmIntegrationsApi.fromConfig(configApi),
  }),
  ScmAuth.createDefaultApiFactory(),

  // Custom FetchApi that automatically injects auth tokens
  // This wraps all fetch calls to include Backstage token + IDP token
  // When openchoreo.features.auth.enabled is false, IDP token injection is skipped
  createApiFactory({
    api: fetchApiRef,
    deps: {
      identityApi: identityApiRef,
      oauthApi: openChoreoIdpAuthApiRef,
      configApi: configApiRef,
    },
    factory: ({ identityApi, oauthApi, configApi }) =>
      new OpenChoreoFetchApi(identityApi, oauthApi, configApi),
  }),

  // OpenChoreo IDP OIDC Auth provider
  createApiFactory({
    api: openChoreoIdpAuthApiRef,
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
          id: 'openchoreo-idp',
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
