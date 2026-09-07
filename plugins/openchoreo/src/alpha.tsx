import {
  ApiBlueprint,
  configApiRef,
  createFrontendPlugin,
  discoveryApiRef,
  fetchApiRef,
  identityApiRef,
  oauthRequestApiRef,
  PageBlueprint,
  PluginWrapperBlueprint,
} from '@backstage/frontend-plugin-api';
import { permissionApiRef } from '@backstage/plugin-permission-react';
import { OAuth2 } from '@backstage/core-app-api';
import {
  EntityCardBlueprint,
  EntityContentBlueprint,
  EntityContentLayoutBlueprint,
  EntityContextMenuItemBlueprint,
} from '@backstage/plugin-catalog-react/alpha';
import {
  isOpenChoreoManagedEntity,
  isOpenChoreoManagedOfKind,
} from '@openchoreo/backstage-plugin-common';
import { FeatureGate } from '@openchoreo/backstage-plugin-react';
import DeleteIcon from '@material-ui/icons/Delete';
import EditIcon from '@material-ui/icons/Edit';
import {
  useDeleteEntityContextMenuItemProps,
  isDeletableOpenChoreoEntity,
} from './components/DeleteEntity/hooks/useDeleteEntityContextMenuItemProps';
import {
  useAnnotationEditorContextMenuItemProps,
  isEditableAnnotationsEntity,
} from './components/AnnotationEditor/useAnnotationEditorContextMenuItemProps';

export { openChoreoEntityPageOverride } from './extensions/openChoreoEntityPageOverride';

import {
  rootCatalogEnvironmentRouteRef,
  accessControlRouteRef,
  execTerminalRouteRef,
  resourceEnvironmentsRouteRef,
} from './routes';
import { openChoreoClientApiRef } from './api/OpenChoreoClientApi';
import { OpenChoreoClient } from './api/OpenChoreoClient';
import { openChoreoAuthApiRef } from './api/authRefs';
import { OpenChoreoFetchApi } from './api/OpenChoreoFetchApi';
import { OpenChoreoPermissionApi } from './api/OpenChoreoPermissionApi';

const openChoreoClientApi = ApiBlueprint.make({
  name: 'open-choreo-client',
  params: defineParams =>
    defineParams({
      api: openChoreoClientApiRef,
      deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
      factory: ({ discoveryApi, fetchApi }) =>
        new OpenChoreoClient(discoveryApi, fetchApi),
    }),
});

// OAuth2 client for the OpenChoreo IDP. Consumed by fetch/permission
// overrides below and by the portal's SignInPage.
const openChoreoAuthApi = ApiBlueprint.make({
  name: 'openchoreo-auth',
  params: defineParams =>
    defineParams({
      api: openChoreoAuthApiRef,
      deps: {
        discoveryApi: discoveryApiRef,
        oauthRequestApi: oauthRequestApiRef,
        configApi: configApiRef,
      },
      factory: ({ discoveryApi, oauthRequestApi, configApi }) => {
        const env =
          configApi.getOptionalString('auth.environment') ?? 'development';
        const scopeStr = configApi.getOptionalString(
          'openchoreo.features.auth.scope',
        );
        const scopes = scopeStr?.split(/\s+/).filter(Boolean) ?? [];
        const defaultScopes = scopes.length
          ? scopes
          : ['openid', 'profile', 'email'];
        return OAuth2.create({
          discoveryApi,
          oauthRequestApi,
          configApi,
          provider: {
            id: 'openchoreo-auth',
            title: 'OpenChoreo',
            icon: () => null,
          },
          environment: env,
          defaultScopes,
        });
      },
    }),
});

// Overrides Backstage's default fetchApiRef to inject Backstage + OC IDP tokens.
const openChoreoFetchApi = ApiBlueprint.make({
  name: 'fetch',
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

// Overrides Backstage's default permissionApiRef to include the IDP token
// in permission checks against OpenChoreo.
const openChoreoPermissionApi = ApiBlueprint.make({
  name: 'permission',
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

// Wraps this plugin's own extensions (tabs/cards) in the TanStack Query
// provider, so every OpenChoreo surface has a QueryClient in the tree —
// response caching is self-contained, the host wires nothing. Uses
// PluginWrapperBlueprint (not AppRootWrapperBlueprint, whose app/root input is
// internal and silently ignores plugin-contributed wrappers). The provider
// references the shared `queryClient` singleton, so multiple OpenChoreo plugins
// each wrapping their own surfaces still share exactly one cache.
const queryProvider = PluginWrapperBlueprint.make({
  name: 'query-provider',
  params: defineParams =>
    defineParams({
      loader: async () => {
        const { OpenChoreoQueryProvider } = await import(
          '@openchoreo/backstage-plugin-react'
        );
        return { component: OpenChoreoQueryProvider };
      },
    }),
});

const resourceDefinitionEntityContent = EntityContentBlueprint.make({
  name: 'resource-definition',
  params: {
    path: '/definition',
    title: 'Definition',
    group: 'definition',
    // API entities are excluded — upstream api-docs owns their /definition tab.
    filter: entity =>
      isOpenChoreoManagedEntity(entity) && entity.kind.toLowerCase() !== 'api',
    loader: () =>
      import('./components/ResourceDefinition').then(m => (
        <m.ResourceDefinitionTab />
      )),
  },
});

// ─── Component-page tabs (kind:component) ─────────────────────────────────
const componentDeployEntityContent = EntityContentBlueprint.make({
  name: 'component-deploy',
  params: {
    path: '/environments',
    title: 'Deploy',
    group: 'deployment',
    filter: isOpenChoreoManagedOfKind('component'),
    loader: () =>
      import('./components/Environments/Environments').then(m => (
        <m.Environments />
      )),
  },
});

// ─── Component-page Overview cards (kind:component) ───────────────────────
const deploymentStatusCard = EntityCardBlueprint.make({
  name: 'deployment-status',
  params: {
    filter: isOpenChoreoManagedOfKind('component'),
    loader: () =>
      import('./components/Environments').then(m => <m.DeploymentStatusCard />),
  },
});

// RuntimeHealthCard is observability-gated. FeatureGate (returns null when
// disabled) is the right wrapper because cards can vanish without breaking
// any route — unlike EntityContent, which must remain in tree.
const runtimeHealthCard = EntityCardBlueprint.make({
  name: 'runtime-health',
  params: {
    filter: isOpenChoreoManagedOfKind('component'),
    loader: () =>
      import('./components/RuntimeLogs').then(m => (
        <FeatureGate feature="observability">
          <m.RuntimeHealthCard />
        </FeatureGate>
      )),
  },
});

// ─── System (project) page tabs + cards (kind:system) ─────────────────────
const cellDiagramEntityContent = EntityContentBlueprint.make({
  name: 'cell-diagram',
  params: {
    path: '/cell-diagram',
    title: 'Cell Diagram',
    group: 'deployment',
    filter: isOpenChoreoManagedOfKind('system'),
    loader: () =>
      import('./components/CellDiagram/CellDiagram').then(m => (
        <m.CellDiagram />
      )),
  },
});

const projectContentsCard = EntityCardBlueprint.make({
  name: 'project-contents',
  params: {
    filter: isOpenChoreoManagedOfKind('system'),
    loader: () =>
      import('./components/Projects/ProjectContentsCard').then(m => (
        <m.ProjectContentsCard />
      )),
  },
});

const deploymentPipelineCard = EntityCardBlueprint.make({
  name: 'deployment-pipeline',
  params: {
    filter: isOpenChoreoManagedOfKind('system'),
    loader: () =>
      import('./components/Projects/OverviewCards').then(m => (
        <m.DeploymentPipelineCard />
      )),
  },
});

// ─── Domain (namespace) page cards (kind:domain) ──────────────────────────
const namespaceProjectsCard = EntityCardBlueprint.make({
  name: 'namespace-projects',
  params: {
    filter: isOpenChoreoManagedOfKind('domain'),
    loader: () =>
      import('./components/Namespaces').then(m => <m.NamespaceProjectsCard />),
  },
});

const namespaceResourcesCard = EntityCardBlueprint.make({
  name: 'namespace-resources',
  params: {
    filter: isOpenChoreoManagedOfKind('domain'),
    loader: () =>
      import('./components/Namespaces').then(m => <m.NamespaceResourcesCard />),
  },
});

// ─── Resource page (managed) tab + cards ──────────────────────────────────
//
// Resources are kind:resource but only "OpenChoreo-managed" resources
// (label-discriminated via `isOpenChoreoManagedOfKind`) get this layout;
// vanilla Resource entities fall through to Backstage defaults.

const resourceDeployEntityContent = EntityContentBlueprint.make({
  name: 'resource-deploy',
  params: {
    path: '/environments',
    title: 'Deploy',
    group: 'deployment',
    filter: isOpenChoreoManagedOfKind('resource'),
    loader: () =>
      import('./components/ResourceEnvironments').then(m => (
        <m.ResourceEnvironments />
      )),
  },
});

const resourceParametersCard = EntityCardBlueprint.make({
  name: 'resource-parameters',
  params: {
    filter: isOpenChoreoManagedOfKind('resource'),
    loader: () =>
      import('./components/ResourceOverview').then(m => (
        <m.ResourceParametersCard />
      )),
  },
});

const resourceDeploymentsCard = EntityCardBlueprint.make({
  name: 'resource-deployments',
  params: {
    filter: isOpenChoreoManagedOfKind('resource'),
    loader: () =>
      import('./components/ResourceOverview').then(m => (
        <m.ResourceDeploymentsCard />
      )),
  },
});

const consumingComponentsCard = EntityCardBlueprint.make({
  name: 'consuming-components',
  params: {
    filter: isOpenChoreoManagedOfKind('resource'),
    loader: () =>
      import('./components/ResourceOverview').then(m => (
        <m.ConsumingComponentsCard />
      )),
  },
});

// ─── Environment page cards (kind:environment) ────────────────────────────
const environmentStatusSummaryCard = EntityCardBlueprint.make({
  name: 'environment-status-summary',
  params: {
    filter: isOpenChoreoManagedOfKind('environment'),
    loader: () =>
      import('./components/EnvironmentOverview').then(m => (
        <m.EnvironmentStatusSummaryCard />
      )),
  },
});

const environmentPromotionCard = EntityCardBlueprint.make({
  name: 'environment-promotion',
  params: {
    filter: isOpenChoreoManagedOfKind('environment'),
    loader: () =>
      import('./components/EnvironmentOverview').then(m => (
        <m.EnvironmentPromotionCard />
      )),
  },
});

const environmentDeployedComponentsCard = EntityCardBlueprint.make({
  name: 'environment-deployed-components',
  params: {
    filter: isOpenChoreoManagedOfKind('environment'),
    loader: () =>
      import('./components/EnvironmentOverview').then(m => (
        <m.EnvironmentDeployedComponentsCard />
      )),
  },
});

const environmentGatewayConfigurationCard = EntityCardBlueprint.make({
  name: 'environment-gateway-configuration',
  params: {
    filter: isOpenChoreoManagedOfKind('environment'),
    loader: () =>
      import('./components/EnvironmentOverview').then(m => (
        <m.EnvironmentGatewayConfigurationCard />
      )),
  },
});

// ─── Dataplane page cards (kind:dataplane) ────────────────────────────────
const dataplaneStatusCard = EntityCardBlueprint.make({
  name: 'dataplane-status',
  params: {
    filter: isOpenChoreoManagedOfKind('dataplane'),
    loader: () =>
      import('./components/DataplaneOverview').then(m => (
        <m.DataplaneStatusCard />
      )),
  },
});

const dataplaneEnvironmentsCard = EntityCardBlueprint.make({
  name: 'dataplane-environments',
  params: {
    filter: isOpenChoreoManagedOfKind('dataplane'),
    loader: () =>
      import('./components/DataplaneOverview').then(m => (
        <m.DataplaneEnvironmentsCard />
      )),
  },
});

const dataplaneGatewayConfigurationCard = EntityCardBlueprint.make({
  name: 'dataplane-gateway-configuration',
  params: {
    filter: isOpenChoreoManagedOfKind('dataplane'),
    loader: () =>
      import('./components/DataplaneOverview').then(m => (
        <m.DataplaneGatewayConfigurationCard />
      )),
  },
});

// ─── ClusterDataplane page cards (kind:clusterdataplane) ──────────────────
const clusterDataplaneStatusCard = EntityCardBlueprint.make({
  name: 'cluster-dataplane-status',
  params: {
    filter: isOpenChoreoManagedOfKind('clusterdataplane'),
    loader: () =>
      import('./components/ClusterDataplaneOverview').then(m => (
        <m.ClusterDataplaneStatusCard />
      )),
  },
});

const clusterDataplaneEnvironmentsCard = EntityCardBlueprint.make({
  name: 'cluster-dataplane-environments',
  params: {
    filter: isOpenChoreoManagedOfKind('clusterdataplane'),
    loader: () =>
      import('./components/ClusterDataplaneOverview').then(m => (
        <m.ClusterDataplaneEnvironmentsCard />
      )),
  },
});

const clusterDataplaneGatewayConfigurationCard = EntityCardBlueprint.make({
  name: 'cluster-dataplane-gateway-configuration',
  params: {
    filter: isOpenChoreoManagedOfKind('clusterdataplane'),
    loader: () =>
      import('./components/ClusterDataplaneOverview').then(m => (
        <m.ClusterDataplaneGatewayConfigurationCard />
      )),
  },
});

// ─── WorkflowPlane / ClusterWorkflowPlane cards ───────────────────────────
const workflowPlaneStatusCard = EntityCardBlueprint.make({
  name: 'workflow-plane-status',
  params: {
    filter: isOpenChoreoManagedOfKind('workflowplane'),
    loader: () =>
      import('./components/WorkflowPlaneOverview').then(m => (
        <m.WorkflowPlaneStatusCard />
      )),
  },
});

const clusterWorkflowPlaneStatusCard = EntityCardBlueprint.make({
  name: 'cluster-workflow-plane-status',
  params: {
    filter: isOpenChoreoManagedOfKind('clusterworkflowplane'),
    loader: () =>
      import('./components/ClusterWorkflowPlaneOverview').then(m => (
        <m.ClusterWorkflowPlaneStatusCard />
      )),
  },
});

// ─── ObservabilityPlane / ClusterObservabilityPlane cards ─────────────────
const observabilityPlaneStatusCard = EntityCardBlueprint.make({
  name: 'observability-plane-status',
  params: {
    filter: isOpenChoreoManagedOfKind('observabilityplane'),
    loader: () =>
      import('./components/ObservabilityPlaneOverview').then(m => (
        <m.ObservabilityPlaneStatusCard />
      )),
  },
});

const observabilityPlaneLinkedPlanesCard = EntityCardBlueprint.make({
  name: 'observability-plane-linked-planes',
  params: {
    filter: isOpenChoreoManagedOfKind('observabilityplane'),
    loader: () =>
      import('./components/ObservabilityPlaneOverview').then(m => (
        <m.ObservabilityPlaneLinkedPlanesCard />
      )),
  },
});

const clusterObservabilityPlaneStatusCard = EntityCardBlueprint.make({
  name: 'cluster-observability-plane-status',
  params: {
    filter: isOpenChoreoManagedOfKind('clusterobservabilityplane'),
    loader: () =>
      import('./components/ClusterObservabilityPlaneOverview').then(m => (
        <m.ClusterObservabilityPlaneStatusCard />
      )),
  },
});

const clusterObservabilityPlaneLinkedPlanesCard = EntityCardBlueprint.make({
  name: 'cluster-observability-plane-linked-planes',
  params: {
    filter: isOpenChoreoManagedOfKind('clusterobservabilityplane'),
    loader: () =>
      import('./components/ClusterObservabilityPlaneOverview').then(m => (
        <m.ClusterObservabilityPlaneLinkedPlanesCard />
      )),
  },
});

// ─── DeploymentPipeline page cards (kind:deploymentpipeline) ──────────────
const deploymentPipelineVisualizationCard = EntityCardBlueprint.make({
  name: 'deployment-pipeline-visualization',
  params: {
    filter: isOpenChoreoManagedOfKind('deploymentpipeline'),
    loader: () =>
      import('./components/DeploymentPipelineOverview').then(m => (
        <m.DeploymentPipelineVisualization />
      )),
  },
});

const promotionPathsCard = EntityCardBlueprint.make({
  name: 'promotion-paths',
  params: {
    filter: isOpenChoreoManagedOfKind('deploymentpipeline'),
    loader: () =>
      import('./components/DeploymentPipelineOverview').then(m => (
        <m.PromotionPathsCard />
      )),
  },
});

// ─── *Type overview cards (componenttype / resourcetype / traittype) ──────
//
// ComponentTypeOverviewCard is reused on kind:componenttype AND
// kind:clustercomponenttype — register once with a multi-kind callable
// filter rather than two near-identical blueprints. Same shape for the
// resource-type and trait-type variants.
const componentTypeOverviewCard = EntityCardBlueprint.make({
  name: 'component-type-overview',
  params: {
    filter: isOpenChoreoManagedOfKind('componenttype', 'clustercomponenttype'),
    loader: () =>
      import('./components/ComponentTypeOverview').then(m => (
        <m.ComponentTypeOverviewCard />
      )),
  },
});

const resourceTypeOverviewCard = EntityCardBlueprint.make({
  name: 'resource-type-overview',
  params: {
    filter: isOpenChoreoManagedOfKind('resourcetype', 'clusterresourcetype'),
    loader: () =>
      import('./components/ResourceTypeOverview').then(m => (
        <m.ResourceTypeOverviewCard />
      )),
  },
});

const traitTypeOverviewCard = EntityCardBlueprint.make({
  name: 'trait-type-overview',
  params: {
    filter: isOpenChoreoManagedOfKind('traittype', 'clustertraittype'),
    loader: () =>
      import('./components/TraitTypeOverview').then(m => (
        <m.TraitTypeOverviewCard />
      )),
  },
});

// ─── Workflow / ClusterWorkflow / ComponentWorkflow overview cards ────────
const workflowOverviewCard = EntityCardBlueprint.make({
  name: 'workflow-overview',
  params: {
    filter: isOpenChoreoManagedOfKind('workflow', 'clusterworkflow'),
    loader: () =>
      import('./components/WorkflowOverview').then(m => (
        <m.WorkflowOverviewCard />
      )),
  },
});

const componentWorkflowOverviewCard = EntityCardBlueprint.make({
  name: 'component-workflow-overview',
  params: {
    filter: isOpenChoreoManagedOfKind('componentworkflow'),
    loader: () =>
      import('./components/ComponentWorkflowOverview').then(m => (
        <m.ComponentWorkflowOverviewCard />
      )),
  },
});

/**
 * NFS entry point for the OpenChoreo plugin.
 *
 * Registers the OpenChoreoClient API, the cross-kind ResourceDefinitionTab,
 * the component-page Deploy tab + DeploymentStatus/RuntimeHealth cards, the
 * system-page Cell Diagram tab + ProjectContents/DeploymentPipeline cards,
 * the domain-page Namespace cards, the managed-resource Deploy tab + cards,
 * and the per-kind overview cards for every OpenChoreo platform kind
 * (Environment, DataPlane/ClusterDataPlane, WorkflowPlane/ClusterWorkflowPlane,
 * ObservabilityPlane/ClusterObservabilityPlane, DeploymentPipeline,
 * ComponentType/ResourceType/TraitType + cluster variants,
 * Workflow/ClusterWorkflow/ComponentWorkflow).
 *
 * The `page:catalog/entity` chrome override (compact header + styled tab
 * bar via `OpenChoreoEntityLayout`) also ships from this plugin now, as
 * `openChoreoEntityPageOverride` — see the re-export near the top of this
 * file. It's a separate feature module external adopters opt into
 * alongside the default plugin.
 */

// ─── Entity context menu items ────────────────────────────────────────────
const deleteEntityContextMenuItem = EntityContextMenuItemBlueprint.make({
  name: 'delete-entity',
  params: {
    icon: <DeleteIcon fontSize="small" />,
    filter: isDeletableOpenChoreoEntity,
    useProps: useDeleteEntityContextMenuItemProps,
  },
});

const editAnnotationsEntityContextMenuItem =
  EntityContextMenuItemBlueprint.make({
    name: 'edit-annotations',
    params: {
      icon: <EditIcon fontSize="small" />,
      filter: isEditableAnnotationsEntity,
      useProps: useAnnotationEditorContextMenuItemProps,
    },
  });

// ─── Per-kind Overview layouts ────────────────────────────────────────────
//
// Each layout attaches to upstream's `entity-content:catalog/overview` via
// `EntityContentLayoutBlueprint`. Upstream's Overview loader picks the
// first layout whose filter matches; anything else falls back to
// `DefaultEntityContentLayout` (upstream's 2-column info/content grid).
//
// Cluster variants of the type-family kinds (`clustercomponenttype`,
// `clusterresourcetype`, `clusterprojecttype`, `clustertraittype`,
// `clusterworkflow`) reuse the same layout module as their namespaced
// counterparts — the visible Overview is identical; only the tab set /
// entity-existence semantics differ, which the tab blueprints handle.

const componentServiceOverviewLayout = EntityContentLayoutBlueprint.make({
  name: 'component-overview',
  params: {
    filter: isOpenChoreoManagedOfKind('component'),
    loader: () =>
      import('./extensions/entityLayouts/ComponentOverviewLayout').then(
        m => m.default,
      ),
  },
});

const systemOverviewLayout = EntityContentLayoutBlueprint.make({
  name: 'system-overview',
  params: {
    filter: isOpenChoreoManagedOfKind('system'),
    loader: () =>
      import('./extensions/entityLayouts/SystemOverviewLayout').then(
        m => m.default,
      ),
  },
});

const domainOverviewLayout = EntityContentLayoutBlueprint.make({
  name: 'domain-overview',
  params: {
    filter: isOpenChoreoManagedOfKind('domain'),
    loader: () =>
      import('./extensions/entityLayouts/DomainOverviewLayout').then(
        m => m.default,
      ),
  },
});

const resourceOverviewLayout = EntityContentLayoutBlueprint.make({
  name: 'resource-overview',
  params: {
    // Only OC-managed resources get the bespoke layout — vanilla Resource
    // entities fall back to upstream `DefaultEntityContentLayout`.
    filter: isOpenChoreoManagedOfKind('resource'),
    loader: () =>
      import('./extensions/entityLayouts/ResourceOverviewLayout').then(
        m => m.default,
      ),
  },
});

const environmentOverviewLayout = EntityContentLayoutBlueprint.make({
  name: 'environment-overview',
  params: {
    filter: isOpenChoreoManagedOfKind('environment'),
    loader: () =>
      import('./extensions/entityLayouts/EnvironmentOverviewLayout').then(
        m => m.default,
      ),
  },
});

const dataplaneOverviewLayout = EntityContentLayoutBlueprint.make({
  name: 'dataplane-overview',
  params: {
    filter: isOpenChoreoManagedOfKind('dataplane'),
    loader: () =>
      import('./extensions/entityLayouts/DataplaneOverviewLayout').then(
        m => m.default,
      ),
  },
});

const clusterDataplaneOverviewLayout = EntityContentLayoutBlueprint.make({
  name: 'cluster-dataplane-overview',
  params: {
    filter: isOpenChoreoManagedOfKind('clusterdataplane'),
    loader: () =>
      import('./extensions/entityLayouts/ClusterDataplaneOverviewLayout').then(
        m => m.default,
      ),
  },
});

const workflowPlaneOverviewLayout = EntityContentLayoutBlueprint.make({
  name: 'workflow-plane-overview',
  params: {
    filter: isOpenChoreoManagedOfKind('workflowplane'),
    loader: () =>
      import('./extensions/entityLayouts/WorkflowPlaneOverviewLayout').then(
        m => m.default,
      ),
  },
});

const clusterWorkflowPlaneOverviewLayout = EntityContentLayoutBlueprint.make({
  name: 'cluster-workflow-plane-overview',
  params: {
    filter: isOpenChoreoManagedOfKind('clusterworkflowplane'),
    loader: () =>
      import(
        './extensions/entityLayouts/ClusterWorkflowPlaneOverviewLayout'
      ).then(m => m.default),
  },
});

const observabilityPlaneOverviewLayout = EntityContentLayoutBlueprint.make({
  name: 'observability-plane-overview',
  params: {
    filter: isOpenChoreoManagedOfKind('observabilityplane'),
    loader: () =>
      import(
        './extensions/entityLayouts/ObservabilityPlaneOverviewLayout'
      ).then(m => m.default),
  },
});

const clusterObservabilityPlaneOverviewLayout =
  EntityContentLayoutBlueprint.make({
    name: 'cluster-observability-plane-overview',
    params: {
      filter: isOpenChoreoManagedOfKind('clusterobservabilityplane'),
      loader: () =>
        import(
          './extensions/entityLayouts/ClusterObservabilityPlaneOverviewLayout'
        ).then(m => m.default),
    },
  });

const deploymentPipelineOverviewLayout = EntityContentLayoutBlueprint.make({
  name: 'deployment-pipeline-overview',
  params: {
    filter: isOpenChoreoManagedOfKind('deploymentpipeline'),
    loader: () =>
      import(
        './extensions/entityLayouts/DeploymentPipelineOverviewLayout'
      ).then(m => m.default),
  },
});

const componentTypeOverviewLayout = EntityContentLayoutBlueprint.make({
  name: 'component-type-overview',
  params: {
    filter: isOpenChoreoManagedOfKind('componenttype', 'clustercomponenttype'),
    loader: () =>
      import('./extensions/entityLayouts/ComponentTypeOverviewLayout').then(
        m => m.default,
      ),
  },
});

const resourceTypeOverviewLayout = EntityContentLayoutBlueprint.make({
  name: 'resource-type-overview',
  params: {
    filter: isOpenChoreoManagedOfKind('resourcetype', 'clusterresourcetype'),
    loader: () =>
      import('./extensions/entityLayouts/ResourceTypeOverviewLayout').then(
        m => m.default,
      ),
  },
});

const projectTypeOverviewLayout = EntityContentLayoutBlueprint.make({
  name: 'project-type-overview',
  params: {
    filter: isOpenChoreoManagedOfKind('projecttype', 'clusterprojecttype'),
    loader: () =>
      import('./extensions/entityLayouts/ProjectTypeOverviewLayout').then(
        m => m.default,
      ),
  },
});

const traitTypeOverviewLayout = EntityContentLayoutBlueprint.make({
  name: 'trait-type-overview',
  params: {
    filter: isOpenChoreoManagedOfKind('traittype', 'clustertraittype'),
    loader: () =>
      import('./extensions/entityLayouts/TraitTypeOverviewLayout').then(
        m => m.default,
      ),
  },
});

const workflowOverviewLayout = EntityContentLayoutBlueprint.make({
  name: 'workflow-overview-layout',
  params: {
    filter: isOpenChoreoManagedOfKind('workflow', 'clusterworkflow'),
    loader: () =>
      import('./extensions/entityLayouts/WorkflowOverviewLayout').then(
        m => m.default,
      ),
  },
});

const componentWorkflowOverviewLayout = EntityContentLayoutBlueprint.make({
  name: 'component-workflow-overview-layout',
  params: {
    filter: isOpenChoreoManagedOfKind('componentworkflow'),
    loader: () =>
      import('./extensions/entityLayouts/ComponentWorkflowOverviewLayout').then(
        m => m.default,
      ),
  },
});

// Scaffolder form field extensions. Adopters get the fields registered
// automatically when they install this plugin, so any OC template
// referencing `ui:field: <Name>` renders correctly.
import { AdvancedConfigurationFieldExtension } from './scaffolder/AdvancedConfigurationField';
import { BuildAndDeployFieldExtension } from './scaffolder/BuildAndDeployField';
import { BuildTemplateParametersFieldExtension } from './scaffolder/BuildTemplateParameters';
import { BuildTemplatePickerFieldExtension } from './scaffolder/BuildTemplatePicker';
import { BuildWorkflowParametersFieldExtension } from './scaffolder/BuildWorkflowParameters';
import { BuildWorkflowPickerFieldExtension } from './scaffolder/BuildWorkflowPicker';
import { ClusterComponentTypeYamlEditorFieldExtension } from './scaffolder/ClusterComponentTypeYamlEditor';
import { ClusterProjectTypeYamlEditorFieldExtension } from './scaffolder/ClusterProjectTypeYamlEditor';
import { ClusterResourceTypeYamlEditorFieldExtension } from './scaffolder/ClusterResourceTypeYamlEditor';
import { ClusterTraitYamlEditorFieldExtension } from './scaffolder/ClusterTraitYamlEditor';
import { ClusterWorkflowYamlEditorFieldExtension } from './scaffolder/ClusterWorkflowYamlEditor';
import { ComponentNamePickerFieldExtension } from './scaffolder/ComponentNamePicker';
import { ComponentTypeYamlEditorFieldExtension } from './scaffolder/ComponentTypeYamlEditor';
import { ComponentWorkflowYamlEditorFieldExtension } from './scaffolder/ComponentWorkflowYamlEditor';
import { ContainerImageFieldExtension } from './scaffolder/ContainerImageField';
import { DeploymentPipelineFormWithYamlFieldExtension } from './scaffolder/DeploymentPipelineFormWithYaml';
import { DeploymentPipelinePickerFieldExtension } from './scaffolder/DeploymentPipelinePicker';
import { DeploymentSourcePickerFieldExtension } from './scaffolder/DeploymentSourcePicker';
import { EnvironmentFormWithYamlFieldExtension } from './scaffolder/EnvironmentFormWithYaml';
import { GitSourceFieldExtension } from './scaffolder/GitSourceField';
import { NamespaceEntityPickerFieldExtension } from './scaffolder/NamespaceEntityPicker';
import { NotificationChannelFormWithYamlFieldExtension } from './scaffolder/NotificationChannelFormWithYaml';
import { ProjectNamespaceFieldExtension } from './scaffolder/ProjectNamespaceField';
import { ProjectParametersFieldExtension } from './scaffolder/ProjectParametersField';
import { ProjectTypeYamlEditorFieldExtension } from './scaffolder/ProjectTypeYamlEditor';
import { ResourceNamePickerFieldExtension } from './scaffolder/ResourceNamePicker';
import { ResourceParametersFieldExtension } from './scaffolder/ResourceParametersField';
import { ResourceTypeYamlEditorFieldExtension } from './scaffolder/ResourceTypeYamlEditor';
import { SwitchFieldExtension } from './scaffolder/SwitchField';
import { TraitYamlEditorFieldExtension } from './scaffolder/TraitYamlEditor';
import { TraitsFieldExtension } from './scaffolder/TraitsField';
import { WorkloadDetailsFieldExtension } from './scaffolder/WorkloadDetailsField';

const scaffolderFieldExtensions = [
  AdvancedConfigurationFieldExtension,
  BuildAndDeployFieldExtension,
  BuildTemplateParametersFieldExtension,
  BuildTemplatePickerFieldExtension,
  BuildWorkflowParametersFieldExtension,
  BuildWorkflowPickerFieldExtension,
  ClusterComponentTypeYamlEditorFieldExtension,
  ClusterProjectTypeYamlEditorFieldExtension,
  ClusterResourceTypeYamlEditorFieldExtension,
  ClusterTraitYamlEditorFieldExtension,
  ClusterWorkflowYamlEditorFieldExtension,
  ComponentNamePickerFieldExtension,
  ComponentTypeYamlEditorFieldExtension,
  ComponentWorkflowYamlEditorFieldExtension,
  ContainerImageFieldExtension,
  DeploymentPipelineFormWithYamlFieldExtension,
  DeploymentPipelinePickerFieldExtension,
  DeploymentSourcePickerFieldExtension,
  EnvironmentFormWithYamlFieldExtension,
  GitSourceFieldExtension,
  NamespaceEntityPickerFieldExtension,
  NotificationChannelFormWithYamlFieldExtension,
  ProjectNamespaceFieldExtension,
  ProjectParametersFieldExtension,
  ProjectTypeYamlEditorFieldExtension,
  ResourceNamePickerFieldExtension,
  ResourceParametersFieldExtension,
  ResourceTypeYamlEditorFieldExtension,
  SwitchFieldExtension,
  TraitYamlEditorFieldExtension,
  TraitsFieldExtension,
  WorkloadDetailsFieldExtension,
];

// Opened via window.open() from the resource drawer; no title/icon = no nav item.
const execTerminalPage = PageBlueprint.make({
  name: 'exec-terminal',
  params: {
    path: '/exec-terminal',
    routeRef: execTerminalRouteRef,
    noHeader: true,
    loader: () =>
      import('./components/Terminal/ExecTerminalWindowPage').then(m => (
        <m.ExecTerminalWindowPage />
      )),
  },
});

export default createFrontendPlugin({
  pluginId: 'openchoreo',
  routes: {
    catalogEnvironment: rootCatalogEnvironmentRouteRef,
    accessControl: accessControlRouteRef,
    execTerminal: execTerminalRouteRef,
    resourceEnvironments: resourceEnvironmentsRouteRef,
  },
  extensions: [
    openChoreoClientApi,
    openChoreoAuthApi,
    openChoreoFetchApi,
    openChoreoPermissionApi,
    queryProvider,
    execTerminalPage,
    deleteEntityContextMenuItem,
    editAnnotationsEntityContextMenuItem,
    resourceDefinitionEntityContent,
    componentDeployEntityContent,
    deploymentStatusCard,
    runtimeHealthCard,
    cellDiagramEntityContent,
    projectContentsCard,
    deploymentPipelineCard,
    namespaceProjectsCard,
    namespaceResourcesCard,
    resourceDeployEntityContent,
    resourceParametersCard,
    resourceDeploymentsCard,
    consumingComponentsCard,
    environmentStatusSummaryCard,
    environmentPromotionCard,
    environmentDeployedComponentsCard,
    environmentGatewayConfigurationCard,
    dataplaneStatusCard,
    dataplaneEnvironmentsCard,
    dataplaneGatewayConfigurationCard,
    clusterDataplaneStatusCard,
    clusterDataplaneEnvironmentsCard,
    clusterDataplaneGatewayConfigurationCard,
    workflowPlaneStatusCard,
    clusterWorkflowPlaneStatusCard,
    observabilityPlaneStatusCard,
    observabilityPlaneLinkedPlanesCard,
    clusterObservabilityPlaneStatusCard,
    clusterObservabilityPlaneLinkedPlanesCard,
    deploymentPipelineVisualizationCard,
    promotionPathsCard,
    componentTypeOverviewCard,
    resourceTypeOverviewCard,
    traitTypeOverviewCard,
    workflowOverviewCard,
    componentWorkflowOverviewCard,
    ...scaffolderFieldExtensions,
    // per-kind Overview layouts
    componentServiceOverviewLayout,
    systemOverviewLayout,
    domainOverviewLayout,
    resourceOverviewLayout,
    environmentOverviewLayout,
    dataplaneOverviewLayout,
    clusterDataplaneOverviewLayout,
    workflowPlaneOverviewLayout,
    clusterWorkflowPlaneOverviewLayout,
    observabilityPlaneOverviewLayout,
    clusterObservabilityPlaneOverviewLayout,
    deploymentPipelineOverviewLayout,
    componentTypeOverviewLayout,
    resourceTypeOverviewLayout,
    projectTypeOverviewLayout,
    traitTypeOverviewLayout,
    workflowOverviewLayout,
    componentWorkflowOverviewLayout,
  ],
});
