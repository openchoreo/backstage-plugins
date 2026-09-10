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
// NOTE: `perchAgentApiRef` is also declared on `openchoreoPerchPlugin.apis`
// in plugins/openchoreo-portal-assistant/src/plugin.ts. That declaration is
// NOT picked up at runtime because the plugin only exports plain React
// components. Removing this app-level factory causes NotImplementedError
// in AssistantDrawerProvider.
import {
  perchAgentApiRef,
  PerchAgentClient,
} from '@openchoreo/backstage-plugin-openchoreo-portal-assistant';

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
  createApiFactory({
    api: perchAgentApiRef,
    deps: {
      discoveryApi: discoveryApiRef,
      fetchApi: fetchApiRef,
    },
    factory: ({ discoveryApi, fetchApi }) =>
      new PerchAgentClient({ discoveryApi, fetchApi }),
  }),
];
