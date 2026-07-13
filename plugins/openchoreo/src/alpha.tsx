import {
  ApiBlueprint,
  createFrontendPlugin,
  discoveryApiRef,
  fetchApiRef,
  PluginWrapperBlueprint,
} from '@backstage/frontend-plugin-api';
import {
  EntityCardBlueprint,
  EntityContentBlueprint,
} from '@backstage/plugin-catalog-react/alpha';
import { CHOREO_LABELS } from '@openchoreo/backstage-plugin-common';
import { FeatureGate } from '@openchoreo/backstage-plugin-react';

import {
  rootCatalogEnvironmentRouteRef,
  accessControlRouteRef,
  resourceEnvironmentsRouteRef,
} from './routes';
import { openChoreoClientApiRef } from './api/OpenChoreoClientApi';
import { OpenChoreoClient } from './api/OpenChoreoClient';

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

// ─── Shared filter for any kind that needs the resource-definition tab ──────
//
// ResourceDefinitionTab is reused on ~20 entity kinds. Register it once with
// a callable filter (rather than 20 string-filter blueprints) so it stays
// a single registration in the alpha export and a single line in the
// extension array.
const KINDS_WITH_RESOURCE_DEFINITION = new Set([
  'component',
  'system',
  'domain',
  'resource',
  'environment',
  'dataplane',
  'clusterdataplane',
  'workflowplane',
  'clusterworkflowplane',
  'observabilityplane',
  'clusterobservabilityplane',
  'deploymentpipeline',
  'componenttype',
  'resourcetype',
  'clustercomponenttype',
  'clusterresourcetype',
  'traittype',
  'clustertraittype',
  'workflow',
  'clusterworkflow',
  'componentworkflow',
]);

const resourceDefinitionEntityContent = EntityContentBlueprint.make({
  name: 'resource-definition',
  params: {
    path: '/definition',
    title: 'Definition',
    filter: entity =>
      KINDS_WITH_RESOURCE_DEFINITION.has(entity.kind.toLowerCase()),
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
    filter: 'kind:component',
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
    filter: 'kind:component',
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
    filter: 'kind:component',
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
    filter: 'kind:system',
    loader: () =>
      import('./components/CellDiagram/CellDiagram').then(m => (
        <m.CellDiagram />
      )),
  },
});

const projectContentsCard = EntityCardBlueprint.make({
  name: 'project-contents',
  params: {
    filter: 'kind:system',
    loader: () =>
      import('./components/Projects/ProjectContentsCard').then(m => (
        <m.ProjectContentsCard />
      )),
  },
});

const deploymentPipelineCard = EntityCardBlueprint.make({
  name: 'deployment-pipeline',
  params: {
    filter: 'kind:system',
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
    filter: 'kind:domain',
    loader: () =>
      import('./components/Namespaces').then(m => <m.NamespaceProjectsCard />),
  },
});

const namespaceResourcesCard = EntityCardBlueprint.make({
  name: 'namespace-resources',
  params: {
    filter: 'kind:domain',
    loader: () =>
      import('./components/Namespaces').then(m => <m.NamespaceResourcesCard />),
  },
});

// ─── Resource page (managed) tab + cards ──────────────────────────────────
//
// Resources are kind:resource but only "OpenChoreo-managed" resources (a
// label-based discriminator) get this layout. Use a callable filter that
// matches on the CHOREO_LABELS.MANAGED label; consumers without the label
// fall through to upstream's default resource page.
const isOpenChoreoManagedResource = (
  entity: import('@backstage/catalog-model').Entity,
) =>
  entity.kind.toLowerCase() === 'resource' &&
  entity.metadata.labels?.[CHOREO_LABELS.MANAGED] === 'true';

const resourceDeployEntityContent = EntityContentBlueprint.make({
  name: 'resource-deploy',
  params: {
    path: '/environments',
    title: 'Deploy',
    filter: isOpenChoreoManagedResource,
    loader: () =>
      import('./components/ResourceEnvironments').then(m => (
        <m.ResourceEnvironments />
      )),
  },
});

const resourceParametersCard = EntityCardBlueprint.make({
  name: 'resource-parameters',
  params: {
    filter: isOpenChoreoManagedResource,
    loader: () =>
      import('./components/ResourceOverview').then(m => (
        <m.ResourceParametersCard />
      )),
  },
});

const resourceDeploymentsCard = EntityCardBlueprint.make({
  name: 'resource-deployments',
  params: {
    filter: isOpenChoreoManagedResource,
    loader: () =>
      import('./components/ResourceOverview').then(m => (
        <m.ResourceDeploymentsCard />
      )),
  },
});

const consumingComponentsCard = EntityCardBlueprint.make({
  name: 'consuming-components',
  params: {
    filter: isOpenChoreoManagedResource,
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
    filter: 'kind:environment',
    loader: () =>
      import('./components/EnvironmentOverview').then(m => (
        <m.EnvironmentStatusSummaryCard />
      )),
  },
});

const environmentPromotionCard = EntityCardBlueprint.make({
  name: 'environment-promotion',
  params: {
    filter: 'kind:environment',
    loader: () =>
      import('./components/EnvironmentOverview').then(m => (
        <m.EnvironmentPromotionCard />
      )),
  },
});

const environmentDeployedComponentsCard = EntityCardBlueprint.make({
  name: 'environment-deployed-components',
  params: {
    filter: 'kind:environment',
    loader: () =>
      import('./components/EnvironmentOverview').then(m => (
        <m.EnvironmentDeployedComponentsCard />
      )),
  },
});

const environmentGatewayConfigurationCard = EntityCardBlueprint.make({
  name: 'environment-gateway-configuration',
  params: {
    filter: 'kind:environment',
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
    filter: 'kind:dataplane',
    loader: () =>
      import('./components/DataplaneOverview').then(m => (
        <m.DataplaneStatusCard />
      )),
  },
});

const dataplaneEnvironmentsCard = EntityCardBlueprint.make({
  name: 'dataplane-environments',
  params: {
    filter: 'kind:dataplane',
    loader: () =>
      import('./components/DataplaneOverview').then(m => (
        <m.DataplaneEnvironmentsCard />
      )),
  },
});

const dataplaneGatewayConfigurationCard = EntityCardBlueprint.make({
  name: 'dataplane-gateway-configuration',
  params: {
    filter: 'kind:dataplane',
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
    filter: 'kind:clusterdataplane',
    loader: () =>
      import('./components/ClusterDataplaneOverview').then(m => (
        <m.ClusterDataplaneStatusCard />
      )),
  },
});

const clusterDataplaneEnvironmentsCard = EntityCardBlueprint.make({
  name: 'cluster-dataplane-environments',
  params: {
    filter: 'kind:clusterdataplane',
    loader: () =>
      import('./components/ClusterDataplaneOverview').then(m => (
        <m.ClusterDataplaneEnvironmentsCard />
      )),
  },
});

const clusterDataplaneGatewayConfigurationCard = EntityCardBlueprint.make({
  name: 'cluster-dataplane-gateway-configuration',
  params: {
    filter: 'kind:clusterdataplane',
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
    filter: 'kind:workflowplane',
    loader: () =>
      import('./components/WorkflowPlaneOverview').then(m => (
        <m.WorkflowPlaneStatusCard />
      )),
  },
});

const clusterWorkflowPlaneStatusCard = EntityCardBlueprint.make({
  name: 'cluster-workflow-plane-status',
  params: {
    filter: 'kind:clusterworkflowplane',
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
    filter: 'kind:observabilityplane',
    loader: () =>
      import('./components/ObservabilityPlaneOverview').then(m => (
        <m.ObservabilityPlaneStatusCard />
      )),
  },
});

const observabilityPlaneLinkedPlanesCard = EntityCardBlueprint.make({
  name: 'observability-plane-linked-planes',
  params: {
    filter: 'kind:observabilityplane',
    loader: () =>
      import('./components/ObservabilityPlaneOverview').then(m => (
        <m.ObservabilityPlaneLinkedPlanesCard />
      )),
  },
});

const clusterObservabilityPlaneStatusCard = EntityCardBlueprint.make({
  name: 'cluster-observability-plane-status',
  params: {
    filter: 'kind:clusterobservabilityplane',
    loader: () =>
      import('./components/ClusterObservabilityPlaneOverview').then(m => (
        <m.ClusterObservabilityPlaneStatusCard />
      )),
  },
});

const clusterObservabilityPlaneLinkedPlanesCard = EntityCardBlueprint.make({
  name: 'cluster-observability-plane-linked-planes',
  params: {
    filter: 'kind:clusterobservabilityplane',
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
    filter: 'kind:deploymentpipeline',
    loader: () =>
      import('./components/DeploymentPipelineOverview').then(m => (
        <m.DeploymentPipelineVisualization />
      )),
  },
});

const promotionPathsCard = EntityCardBlueprint.make({
  name: 'promotion-paths',
  params: {
    filter: 'kind:deploymentpipeline',
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
    filter: entity =>
      ['componenttype', 'clustercomponenttype'].includes(
        entity.kind.toLowerCase(),
      ),
    loader: () =>
      import('./components/ComponentTypeOverview').then(m => (
        <m.ComponentTypeOverviewCard />
      )),
  },
});

const resourceTypeOverviewCard = EntityCardBlueprint.make({
  name: 'resource-type-overview',
  params: {
    filter: entity =>
      ['resourcetype', 'clusterresourcetype'].includes(
        entity.kind.toLowerCase(),
      ),
    loader: () =>
      import('./components/ResourceTypeOverview').then(m => (
        <m.ResourceTypeOverviewCard />
      )),
  },
});

const traitTypeOverviewCard = EntityCardBlueprint.make({
  name: 'trait-type-overview',
  params: {
    filter: entity =>
      ['traittype', 'clustertraittype'].includes(entity.kind.toLowerCase()),
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
    filter: entity =>
      ['workflow', 'clusterworkflow'].includes(entity.kind.toLowerCase()),
    loader: () =>
      import('./components/WorkflowOverview').then(m => (
        <m.WorkflowOverviewCard />
      )),
  },
});

const componentWorkflowOverviewCard = EntityCardBlueprint.make({
  name: 'component-workflow-overview',
  params: {
    filter: 'kind:componentworkflow',
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
 * Host-only mounts (OpenChoreoAboutCard, EntityCatalogGraphCard with custom
 * relations, WorkflowsOrExternalCICard, the Overview FailedBuildSnackbar) stay
 * in `packages/app` and ride through `customAppModule` because they belong
 * to the host's composition layer, not to this plugin.
 */
export default createFrontendPlugin({
  pluginId: 'openchoreo',
  routes: {
    catalogEnvironment: rootCatalogEnvironmentRouteRef,
    accessControl: accessControlRouteRef,
    resourceEnvironments: resourceEnvironmentsRouteRef,
  },
  extensions: [
    openChoreoClientApi,
    queryProvider,
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
  ],
});
