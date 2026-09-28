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
  errorApiRef,
  identityApiRef,
  fetchApiRef,
  storageApiRef,
} from '@backstage/core-plugin-api';
import { VisitsWebStorageApi, visitsApiRef } from '@backstage/plugin-home';
import { UserSettingsStorage } from '@backstage/plugin-user-settings';

// OpenChoreo fetch/permission/auth factories are contributed by
// `@openchoreo/backstage-plugin` (base) as ApiBlueprints — no manual
// registration needed here.
export const apis: AnyApiFactory[] = [
  createApiFactory({
    api: scmIntegrationsApiRef,
    deps: { configApi: configApiRef },
    factory: ({ configApi }) => ScmIntegrationsApi.fromConfig(configApi),
  }),
  ScmAuth.createDefaultApiFactory(),
  createApiFactory({
    api: visitsApiRef,
    deps: {
      identityApi: identityApiRef,
      errorApi: errorApiRef,
    },
    factory: ({ identityApi, errorApi }) =>
      VisitsWebStorageApi.create({ identityApi, errorApi }),
  }),
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
