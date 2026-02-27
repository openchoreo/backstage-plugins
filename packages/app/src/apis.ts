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
import { UserSettingsStorage } from '@backstage/plugin-user-settings';
import { permissionApiRef } from '@backstage/plugin-permission-react';
import { OpenChoreoFetchApi } from './apis/OpenChoreoFetchApi';
import { OpenChoreoPermissionApi } from './apis/OpenChoreoPermissionApi';
import {
  formDecoratorsApiRef,
  DefaultScaffolderFormDecoratorsApi,
} from '@backstage/plugin-scaffolder/alpha';
import { openChoreoTokenDecorator } from './scaffolder/openChoreoTokenDecorator';
// Import from separate file to avoid circular dependency with form decorators
import { openChoreoAuthApiRef } from './apis/authRefs';
import {
  openChoreoCiClientApiRef,
  OpenChoreoCiClient,
} from '@openchoreo/backstage-plugin-openchoreo-ci';
import {
  genericWorkflowsClientApiRef,
  GenericWorkflowsClient,
} from '@openchoreo/backstage-plugin-openchoreo-workflows';
import {
  catalogApiRef,
  entityPresentationApiRef,
} from '@backstage/plugin-catalog-react';
import { DefaultEntityPresentationApi } from '@backstage/plugin-catalog';
import {
  catalogGraphApiRef,
  DefaultCatalogGraphApi,
  ALL_RELATIONS,
  ALL_RELATION_PAIRS,
} from '@backstage/plugin-catalog-graph';
import {
  RELATION_PROMOTES_TO,
  RELATION_PROMOTED_BY,
  RELATION_USES_PIPELINE,
  RELATION_PIPELINE_USED_BY,
  RELATION_HOSTED_ON,
  RELATION_HOSTS,
  RELATION_OBSERVED_BY,
  RELATION_OBSERVES,
  RELATION_INSTANCE_OF,
  RELATION_HAS_INSTANCE,
  RELATION_USES_WORKFLOW,
  RELATION_WORKFLOW_USED_BY,
  RELATION_BUILDS_ON,
  RELATION_BUILDS,
} from '@openchoreo/backstage-plugin-common';
import CloudIcon from '@material-ui/icons/Cloud';
import DnsIcon from '@material-ui/icons/Dns';
import AccountTreeIcon from '@material-ui/icons/AccountTree';
import VisibilityIcon from '@material-ui/icons/Visibility';
import BuildIcon from '@material-ui/icons/Build';
import CategoryIcon from '@material-ui/icons/Category';
import ExtensionIcon from '@material-ui/icons/Extension';
import PlayCircleOutlineIcon from '@material-ui/icons/PlayCircleOutline';
import SettingsApplicationsIcon from '@material-ui/icons/SettingsApplications';

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

  // Form decorators for scaffolder - injects user's OpenChoreo token as a secret
  // This enables user-based authorization in scaffolder actions
  createApiFactory({
    api: formDecoratorsApiRef,
    deps: {},
    factory: () =>
      DefaultScaffolderFormDecoratorsApi.create({
        decorators: [openChoreoTokenDecorator],
      }),
  }),

  // OpenChoreo CI client - provides API for workflow/build operations
  createApiFactory({
    api: openChoreoCiClientApiRef,
    deps: {
      discoveryApi: discoveryApiRef,
      fetchApi: fetchApiRef,
    },
    factory: ({ discoveryApi, fetchApi }) =>
      new OpenChoreoCiClient(discoveryApi, fetchApi),
  }),

  // Catalog graph API with custom OpenChoreo relations
  // Without this, custom relations (promotesTo, hostedOn, instanceOf, etc.)
  // won't appear in entity Relations cards or the catalog graph
  createApiFactory({
    api: catalogGraphApiRef,
    deps: {},
    factory: () =>
      new DefaultCatalogGraphApi({
        knownRelations: [
          ...ALL_RELATIONS,
          RELATION_PROMOTES_TO,
          RELATION_PROMOTED_BY,
          RELATION_USES_PIPELINE,
          RELATION_PIPELINE_USED_BY,
          RELATION_HOSTED_ON,
          RELATION_HOSTS,
          RELATION_OBSERVED_BY,
          RELATION_OBSERVES,
          RELATION_INSTANCE_OF,
          RELATION_HAS_INSTANCE,
          RELATION_USES_WORKFLOW,
          RELATION_WORKFLOW_USED_BY,
          RELATION_BUILDS_ON,
          RELATION_BUILDS,
        ],
        knownRelationPairs: [
          ...ALL_RELATION_PAIRS,
          [RELATION_PROMOTES_TO, RELATION_PROMOTED_BY],
          [RELATION_USES_PIPELINE, RELATION_PIPELINE_USED_BY],
          [RELATION_HOSTED_ON, RELATION_HOSTS],
          [RELATION_OBSERVED_BY, RELATION_OBSERVES],
          [RELATION_INSTANCE_OF, RELATION_HAS_INSTANCE],
          [RELATION_USES_WORKFLOW, RELATION_WORKFLOW_USED_BY],
          [RELATION_BUILDS_ON, RELATION_BUILDS],
        ],
        defaultRelationTypes: { exclude: [] },
      }),
  }),

  // Generic Workflows client - provides API for org-level workflow operations
  createApiFactory({
    api: genericWorkflowsClientApiRef,
    deps: {
      discoveryApi: discoveryApiRef,
      fetchApi: fetchApiRef,
    },
    factory: ({ discoveryApi, fetchApi }) =>
      new GenericWorkflowsClient(discoveryApi, fetchApi),
  }),

  // Custom EntityPresentationApi with icons for custom entity kinds
  // This enables icons for Environment, DataPlane, and DeploymentPipeline in the catalog graph
  createApiFactory({
    api: entityPresentationApiRef,
    deps: { catalogApi: catalogApiRef },
    factory: ({ catalogApi }) =>
      DefaultEntityPresentationApi.create({
        catalogApi,
        kindIcons: {
          environment: CloudIcon,
          dataplane: DnsIcon,
          clusterdataplane: DnsIcon,
          deploymentpipeline: AccountTreeIcon,
          observabilityplane: VisibilityIcon,
          clusterobservabilityplane: VisibilityIcon,
          buildplane: BuildIcon,
          clusterbuildplane: BuildIcon,
          componenttype: CategoryIcon,
          clustercomponenttype: CategoryIcon,
          traittype: ExtensionIcon,
          clustertraittype: ExtensionIcon,
          workflow: PlayCircleOutlineIcon,
          componentworkflow: SettingsApplicationsIcon,
        },
      }),
  }),
];
