import { Grid } from '@material-ui/core';
import {
  EntityApiDefinitionCard,
  EntityConsumedApisCard,
  EntityConsumingComponentsCard,
  EntityProvidedApisCard,
  EntityProvidingComponentsCard,
} from '@backstage/plugin-api-docs';
import {
  EntityAboutCard,
  EntityDependsOnComponentsCard,
  EntityDependsOnResourcesCard,
  EntityHasComponentsCard,
  EntityLayout,
  EntityLinksCard,
  EntitySwitch,
  EntityOrphanWarning,
  EntityProcessingErrorsPanel,
  isKind,
  hasCatalogProcessingErrors,
  isOrphan,
  hasRelationWarnings,
  EntityRelationWarning,
} from '@backstage/plugin-catalog';
import {
  ComponentTypeUtils,
  type PageVariant,
} from '@openchoreo/backstage-plugin-common';
import {
  EntityUserProfileCard,
  EntityGroupProfileCard,
  EntityMembersListCard,
  EntityOwnershipCard,
} from '@backstage/plugin-org';
import { EntityTechdocsContent } from '@backstage/plugin-techdocs';
import {
  Direction,
  EntityCatalogGraphCard,
} from '@backstage/plugin-catalog-graph';
import {
  Entity,
  RELATION_API_CONSUMED_BY,
  RELATION_API_PROVIDED_BY,
  RELATION_CONSUMES_API,
  RELATION_DEPENDENCY_OF,
  RELATION_DEPENDS_ON,
  RELATION_HAS_PART,
  RELATION_PART_OF,
  RELATION_PROVIDES_API,
} from '@backstage/catalog-model';
import {
  RELATION_PROMOTES_TO,
  RELATION_PROMOTED_BY,
  RELATION_USES_PIPELINE,
  RELATION_PIPELINE_USED_BY,
  RELATION_HOSTED_ON,
  RELATION_HOSTS,
  RELATION_OBSERVED_BY,
  RELATION_OBSERVES,
  RELATION_USES_WORKFLOW,
  RELATION_WORKFLOW_USED_BY,
} from '@openchoreo/backstage-plugin-common';

import { TechDocsAddons } from '@backstage/plugin-techdocs-react';
import { ReportIssue } from '@backstage/plugin-techdocs-module-addons-contrib';

import {
  EntityKubernetesContent,
  isKubernetesAvailable,
} from '@backstage/plugin-kubernetes';

import {
  Environments,
  CellDiagram,
  ProductionOverviewCard,
  RuntimeHealthCard,
  DeploymentPipelineCard,
  ProjectComponentsCard,
  NamespaceProjectsCard,
  NamespaceResourcesCard,
  Traits,
  EnvironmentStatusSummaryCard,
  EnvironmentDeployedComponentsCard,
  EnvironmentPromotionCard,
  DataplaneStatusCard,
  DataplaneEnvironmentsCard,
  ClusterDataplaneStatusCard,
  ClusterDataplaneEnvironmentsCard,
  BuildPlaneStatusCard,
  ClusterBuildPlaneStatusCard,
  ObservabilityPlaneStatusCard,
  ObservabilityPlaneLinkedPlanesCard,
  ClusterObservabilityPlaneStatusCard,
  ClusterObservabilityPlaneLinkedPlanesCard,
  DeploymentPipelineVisualization,
  PromotionPathsCard,
  ComponentTypeOverviewCard,
  TraitTypeOverviewCard,
  WorkflowOverviewCard,
  ComponentWorkflowOverviewCard,
  ResourceDefinitionTab,
} from '@openchoreo/backstage-plugin';
import { EntityLayoutWithDelete } from './EntityLayoutWithDelete';

import { Workflows } from '@openchoreo/backstage-plugin-openchoreo-ci';
import {
  WorkflowRunsContent,
  EntityNamespaceProvider,
} from '@openchoreo/backstage-plugin-openchoreo-workflows';

import {
  ObservabilityMetrics,
  ObservabilityTraces,
  ObservabilityRCA,
  ObservabilityRuntimeLogs,
} from '@openchoreo/backstage-plugin-openchoreo-observability';

import {
  FeatureGate,
  CustomGraphNode,
  OpenChoreoEntityLayout,
} from '@openchoreo/backstage-plugin-react';
import { FeatureGatedContent } from './FeatureGatedContent';
import { WorkflowsOrExternalCICard } from './WorkflowsOrExternalCICard';

// External CI Platform imports
import { EntityJenkinsContent } from '@backstage-community/plugin-jenkins';
import { EntityGithubActionsContent } from '@backstage-community/plugin-github-actions';
import { EntityGitlabContent } from '@immobiliarelabs/backstage-plugin-gitlab';

const PLATFORM_KIND_DISPLAY_NAMES: Record<string, string> = {
  domain: 'Namespace',
  dataplane: 'Dataplane',
  clusterdataplane: 'Cluster Data Plane',
  buildplane: 'Build Plane',
  clusterbuildplane: 'Cluster Build Plane',
  observabilityplane: 'Observability Plane',
  clusterobservabilityplane: 'Cluster Observability Plane',
  environment: 'Environment',
  deploymentpipeline: 'Deployment Pipeline',
  componenttype: 'Component Type',
  clustercomponenttype: 'Cluster Component Type',
  traittype: 'Trait Type',
  clustertraittype: 'Cluster Trait Type',
  workflow: 'Workflow',
  componentworkflow: 'Component Workflow',
};

// Annotation predicates for conditionally showing CI tabs
const hasJenkinsAnnotation = (entity: Entity) =>
  Boolean(entity.metadata.annotations?.['jenkins.io/job-full-name']);

const hasGithubActionsAnnotation = (entity: Entity) =>
  Boolean(entity.metadata.annotations?.['github.com/project-slug']);

const hasGitlabAnnotation = (entity: Entity) =>
  Boolean(
    entity.metadata.annotations?.['gitlab.com/project-slug'] ||
      entity.metadata.annotations?.['gitlab.com/project-id'],
  );

const hasTechdocsAnnotation = (entity: Entity) =>
  Boolean(entity.metadata.annotations?.['backstage.io/techdocs-ref']);

const techdocsContent = (
  <EntityTechdocsContent>
    <TechDocsAddons>
      <ReportIssue />
    </TechDocsAddons>
  </EntityTechdocsContent>
);

const entityWarningContent = (
  <>
    <EntitySwitch>
      <EntitySwitch.Case if={isOrphan}>
        <Grid item xs={12}>
          <EntityOrphanWarning />
        </Grid>
      </EntitySwitch.Case>
    </EntitySwitch>

    <EntitySwitch>
      <EntitySwitch.Case if={hasRelationWarnings}>
        <Grid item xs={12}>
          <EntityRelationWarning />
        </Grid>
      </EntitySwitch.Case>
    </EntitySwitch>

    <EntitySwitch>
      <EntitySwitch.Case if={hasCatalogProcessingErrors}>
        <Grid item xs={12}>
          <EntityProcessingErrorsPanel />
        </Grid>
      </EntitySwitch.Case>
    </EntitySwitch>
  </>
);

/**
 * Overview content component with feature-gated cards.
 * WorkflowsOverviewCard or External CI card shown based on annotations.
 * RuntimeHealthCard is gated by observability feature.
 */
function OverviewContent() {
  return (
    <Grid container spacing={3} alignItems="stretch">
      {entityWarningContent}
      <EntitySwitch>
        <EntitySwitch.Case if={isKind('component')}>
          {/* CI Status Card - shows external CI card if annotation present, otherwise OpenChoreo WorkflowsOverviewCard */}
          <WorkflowsOrExternalCICard />
          <Grid item md={4} xs={12}>
            <ProductionOverviewCard />
          </Grid>
          <FeatureGate feature="observability">
            <Grid item md={4} xs={12}>
              <RuntimeHealthCard />
            </Grid>
          </FeatureGate>
        </EntitySwitch.Case>
      </EntitySwitch>
      <Grid item md={6}>
        <EntityAboutCard variant="gridItem" />
      </Grid>
      <Grid item md={6} xs={12}>
        <EntityCatalogGraphCard
          variant="gridItem"
          height={400}
          renderNode={CustomGraphNode}
        />
      </Grid>
    </Grid>
  );
}

/**
 * Service entity page with delete menu support.
 * Routes are defined as static JSX children so routable extensions are discoverable.
 */
const serviceEntityPage = (
  <EntityLayoutWithDelete>
    <EntityLayout.Route path="/" title="Overview">
      <OverviewContent />
    </EntityLayout.Route>

    <EntityLayout.Route path="/workflows" title="Workflows">
      <FeatureGatedContent feature="workflows">
        <Workflows />
      </FeatureGatedContent>
    </EntityLayout.Route>

    <EntityLayout.Route path="/environments" title="Deploy">
      <Environments />
    </EntityLayout.Route>

    <EntityLayout.Route path="/traits" title="Traits">
      <Traits />
    </EntityLayout.Route>

    <EntityLayout.Route path="/runtime-logs" title="Logs">
      <FeatureGatedContent feature="observability">
        <ObservabilityRuntimeLogs />
      </FeatureGatedContent>
    </EntityLayout.Route>

    <EntityLayout.Route path="/metrics" title="Metrics">
      <FeatureGatedContent feature="observability">
        <ObservabilityMetrics />
      </FeatureGatedContent>
    </EntityLayout.Route>

    <EntityLayout.Route
      path="/kubernetes"
      title="Kubernetes"
      if={isKubernetesAvailable}
    >
      <EntityKubernetesContent />
    </EntityLayout.Route>

    <EntityLayout.Route path="/api" title="API">
      <Grid container spacing={3} alignItems="stretch">
        <Grid item md={6}>
          <EntityProvidedApisCard />
        </Grid>
        <Grid item md={6}>
          <EntityConsumedApisCard />
        </Grid>
      </Grid>
    </EntityLayout.Route>

    <EntityLayout.Route path="/dependencies" title="Dependencies">
      <Grid container spacing={3} alignItems="stretch">
        <Grid item md={6}>
          <EntityDependsOnComponentsCard variant="gridItem" />
        </Grid>
        <Grid item md={6}>
          <EntityDependsOnResourcesCard variant="gridItem" />
        </Grid>
      </Grid>
    </EntityLayout.Route>

    <EntityLayout.Route path="/docs" title="Docs" if={hasTechdocsAnnotation}>
      {techdocsContent}
    </EntityLayout.Route>

    {/* External CI Platform Tabs - only shown when annotation is present */}
    <EntityLayout.Route
      path="/jenkins"
      title="Jenkins"
      if={hasJenkinsAnnotation}
    >
      <EntityJenkinsContent />
    </EntityLayout.Route>

    <EntityLayout.Route
      path="/github-actions"
      title="GitHub Actions"
      if={hasGithubActionsAnnotation}
    >
      <EntityGithubActionsContent />
    </EntityLayout.Route>

    <EntityLayout.Route path="/gitlab" title="GitLab" if={hasGitlabAnnotation}>
      <EntityGitlabContent />
    </EntityLayout.Route>
  </EntityLayoutWithDelete>
);

/**
 * Website entity page with delete menu support.
 * Routes are defined as static JSX children so routable extensions are discoverable.
 */
const genericComponentEntityPage = (
  <EntityLayoutWithDelete>
    <EntityLayout.Route path="/" title="Overview">
      <OverviewContent />
    </EntityLayout.Route>

    <EntityLayout.Route path="/workflows" title="Workflows">
      <FeatureGatedContent feature="workflows">
        <Workflows />
      </FeatureGatedContent>
    </EntityLayout.Route>

    <EntityLayout.Route path="/environments" title="Deploy">
      <Environments />
    </EntityLayout.Route>

    <EntityLayout.Route path="/traits" title="Traits">
      <Traits />
    </EntityLayout.Route>

    <EntityLayout.Route path="/runtime-logs" title="Logs">
      <FeatureGatedContent feature="observability">
        <ObservabilityRuntimeLogs />
      </FeatureGatedContent>
    </EntityLayout.Route>

    <EntityLayout.Route path="/metrics" title="Metrics">
      <FeatureGatedContent feature="observability">
        <ObservabilityMetrics />
      </FeatureGatedContent>
    </EntityLayout.Route>

    <EntityLayout.Route
      path="/kubernetes"
      title="Kubernetes"
      if={isKubernetesAvailable}
    >
      <EntityKubernetesContent />
    </EntityLayout.Route>

    <EntityLayout.Route path="/dependencies" title="Dependencies">
      <Grid container spacing={3} alignItems="stretch">
        <Grid item md={6}>
          <EntityDependsOnComponentsCard variant="gridItem" />
        </Grid>
        <Grid item md={6}>
          <EntityDependsOnResourcesCard variant="gridItem" />
        </Grid>
      </Grid>
    </EntityLayout.Route>

    <EntityLayout.Route path="/docs" title="Docs" if={hasTechdocsAnnotation}>
      {techdocsContent}
    </EntityLayout.Route>

    {/* External CI Platform Tabs - only shown when annotation is present */}
    <EntityLayout.Route
      path="/jenkins"
      title="Jenkins"
      if={hasJenkinsAnnotation}
    >
      <EntityJenkinsContent />
    </EntityLayout.Route>

    <EntityLayout.Route
      path="/github-actions"
      title="GitHub Actions"
      if={hasGithubActionsAnnotation}
    >
      <EntityGithubActionsContent />
    </EntityLayout.Route>

    <EntityLayout.Route path="/gitlab" title="GitLab" if={hasGitlabAnnotation}>
      <EntityGitlabContent />
    </EntityLayout.Route>
  </EntityLayoutWithDelete>
);

/**
 * NOTE: This page is designed to work on small screens such as mobile devices.
 * This is based on Material UI Grid. If breakpoints are used, each grid item must set the `xs` prop to a column size or to `true`,
 * since this does not default. If no breakpoints are used, the items will equitably share the available space.
 * https://material-ui.com/components/grid/#basic-grid.
 */

const defaultEntityPage = (
  <EntityLayout UNSTABLE_contextMenuOptions={{ disableUnregister: 'hidden' }}>
    <EntityLayout.Route path="/" title="Overview">
      <OverviewContent />
    </EntityLayout.Route>

    <EntityLayout.Route path="/docs" title="Docs" if={hasTechdocsAnnotation}>
      {techdocsContent}
    </EntityLayout.Route>
  </EntityLayout>
);

/**
 * Helper function to determine the page variant for a component entity.
 * Uses ComponentTypeUtils to map OpenChoreo component types to page variants.
 */
function getComponentPageVariant(entity: Entity): PageVariant {
  if (entity.kind !== 'Component') return 'default';

  const componentType = entity.spec?.type as string;
  if (!componentType) return 'default';

  // Use default mappings for routing decisions
  const utils = ComponentTypeUtils.createDefault();
  return utils.getPageVariant(componentType);
}

/**
 * Condition functions for EntitySwitch routing.
 * These determine which page variant to show based on the component type.
 */
const isServiceComponent = (entity: Entity) =>
  getComponentPageVariant(entity) === 'service';

const isGenericComponent = (entity: Entity) =>
  getComponentPageVariant(entity) !== 'service';

const componentPage = (
  <EntitySwitch>
    <EntitySwitch.Case if={isServiceComponent}>
      {serviceEntityPage}
    </EntitySwitch.Case>

    <EntitySwitch.Case if={isGenericComponent}>
      {genericComponentEntityPage}
    </EntitySwitch.Case>

    {/* Fallback for unknown component types or 'default' variant */}
    <EntitySwitch.Case>{defaultEntityPage}</EntitySwitch.Case>
  </EntitySwitch>
);

const apiPage = (
  <EntityLayout UNSTABLE_contextMenuOptions={{ disableUnregister: 'hidden' }}>
    <EntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3}>
        {entityWarningContent}
        <Grid item md={6}>
          <EntityAboutCard />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard
            variant="gridItem"
            height={400}
            renderNode={CustomGraphNode}
          />
        </Grid>
        <Grid item md={4} xs={12}>
          <EntityLinksCard />
        </Grid>
        <Grid container item md={12}>
          <Grid item md={6}>
            <EntityProvidingComponentsCard />
          </Grid>
          <Grid item md={6}>
            <EntityConsumingComponentsCard />
          </Grid>
        </Grid>
      </Grid>
    </EntityLayout.Route>

    <EntityLayout.Route path="/definition" title="Definition">
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <EntityApiDefinitionCard />
        </Grid>
      </Grid>
    </EntityLayout.Route>
  </EntityLayout>
);

const userPage = (
  <EntityLayout UNSTABLE_contextMenuOptions={{ disableUnregister: 'hidden' }}>
    <EntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3}>
        {entityWarningContent}
        <Grid item xs={12} md={6}>
          <EntityUserProfileCard variant="gridItem" />
        </Grid>
        <Grid item xs={12} md={6}>
          <EntityOwnershipCard variant="gridItem" />
        </Grid>
      </Grid>
    </EntityLayout.Route>
  </EntityLayout>
);

const groupPage = (
  <EntityLayout UNSTABLE_contextMenuOptions={{ disableUnregister: 'hidden' }}>
    <EntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3}>
        {entityWarningContent}
        <Grid item xs={12} md={6}>
          <EntityGroupProfileCard variant="gridItem" />
        </Grid>
        <Grid item xs={12} md={6}>
          <EntityOwnershipCard variant="gridItem" />
        </Grid>
        <Grid item xs={12} md={6}>
          <EntityMembersListCard />
        </Grid>
        <Grid item xs={12} md={6}>
          <EntityLinksCard />
        </Grid>
      </Grid>
    </EntityLayout.Route>
  </EntityLayout>
);

/**
 * System page (for Projects) with delete menu support.
 * Uses OpenChoreoEntityLayout (via EntityLayoutWithDelete) for compact header
 * with kind display name override: system → Project.
 */
const systemPage = (
  <EntityLayoutWithDelete>
    <EntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3} alignItems="stretch">
        {entityWarningContent}
        {/* Row 1: Has Components + Deployment Pipeline */}
        <Grid item md={8} xs={12}>
          <ProjectComponentsCard />
        </Grid>
        <Grid item md={4} xs={12}>
          <DeploymentPipelineCard />
        </Grid>

        {/* Row 2: About + Catalog Relations */}
        <Grid item md={6} xs={12}>
          <EntityAboutCard variant="gridItem" />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard
            variant="gridItem"
            height={400}
            renderNode={CustomGraphNode}
          />
        </Grid>
      </Grid>
    </EntityLayout.Route>
    <EntityLayout.Route path="/cell-diagram" title="Cell Diagram">
      <CellDiagram />
    </EntityLayout.Route>
    <EntityLayout.Route path="/diagram" title="Diagram">
      <EntityCatalogGraphCard
        variant="gridItem"
        direction={Direction.TOP_BOTTOM}
        title="System Diagram"
        height={700}
        relations={[
          RELATION_PART_OF,
          RELATION_HAS_PART,
          RELATION_API_CONSUMED_BY,
          RELATION_API_PROVIDED_BY,
          RELATION_CONSUMES_API,
          RELATION_PROVIDES_API,
          RELATION_DEPENDENCY_OF,
          RELATION_DEPENDS_ON,
        ]}
        unidirectional={false}
        renderNode={CustomGraphNode}
      />
    </EntityLayout.Route>
    <EntityLayout.Route path="/traces" title="Traces">
      <FeatureGatedContent feature="observability">
        <ObservabilityTraces />
      </FeatureGatedContent>
    </EntityLayout.Route>
    <EntityLayout.Route path="/rca-reports" title="RCA Reports">
      <FeatureGatedContent feature="observability">
        <ObservabilityRCA />
      </FeatureGatedContent>
    </EntityLayout.Route>
  </EntityLayoutWithDelete>
);

/**
 * Domain page. Uses OpenChoreoEntityLayout with kindDisplayNames
 * to show "Namespace" instead of "Domain" for OpenChoreo domains.
 */
const domainPage = (
  <OpenChoreoEntityLayout
    contextMenuOptions={{ disableUnregister: 'hidden' }}
    kindDisplayNames={{ domain: 'Namespace' }}
  >
    <OpenChoreoEntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3} alignItems="stretch">
        {entityWarningContent}
        <Grid item md={6}>
          <NamespaceProjectsCard />
        </Grid>
        <Grid item md={6}>
          <NamespaceResourcesCard />
        </Grid>
        <Grid item md={6}>
          <EntityAboutCard variant="gridItem" />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard
            variant="gridItem"
            height={500}
            zoom="enabled"
            maxDepth={1}
            renderNode={CustomGraphNode}
          />
        </Grid>
      </Grid>
    </OpenChoreoEntityLayout.Route>
  </OpenChoreoEntityLayout>
);

const resourcePage = (
  <EntityLayout UNSTABLE_contextMenuOptions={{ disableUnregister: 'hidden' }}>
    <EntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3} alignItems="stretch">
        {entityWarningContent}
        <Grid item md={6}>
          <EntityAboutCard variant="gridItem" />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard
            variant="gridItem"
            height={400}
            renderNode={CustomGraphNode}
          />
        </Grid>
        <Grid item md={4} xs={12}>
          <EntityLinksCard />
        </Grid>
        <Grid item md={8}>
          <EntityHasComponentsCard variant="gridItem" />
        </Grid>
      </Grid>
    </EntityLayout.Route>
  </EntityLayout>
);

const environmentPage = (
  <OpenChoreoEntityLayout
    contextMenuOptions={{ disableUnregister: 'hidden' }}
    parentEntityRelations={['partOf']}
    kindDisplayNames={PLATFORM_KIND_DISPLAY_NAMES}
  >
    <OpenChoreoEntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3} alignItems="stretch">
        {entityWarningContent}
        {/* Row 1: Deployment Health + Deployment Pipelines */}
        <Grid item md={6} xs={12}>
          <EnvironmentStatusSummaryCard />
        </Grid>
        <Grid item md={6} xs={12}>
          <EnvironmentPromotionCard />
        </Grid>
        {/* Row 2: Deployed Components */}
        <Grid item xs={12}>
          <EnvironmentDeployedComponentsCard />
        </Grid>
        {/* Row 3: About + Catalog Graph */}
        <Grid item md={6} xs={12}>
          <EntityAboutCard variant="gridItem" />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard
            variant="gridItem"
            height={400}
            relations={[
              RELATION_PART_OF,
              RELATION_HAS_PART,
              RELATION_PROMOTES_TO,
              RELATION_PROMOTED_BY,
              RELATION_HOSTED_ON,
              RELATION_HOSTS,
            ]}
            renderNode={CustomGraphNode}
          />
        </Grid>
      </Grid>
    </OpenChoreoEntityLayout.Route>
    <OpenChoreoEntityLayout.Route path="/definition" title="Definition">
      <ResourceDefinitionTab />
    </OpenChoreoEntityLayout.Route>
  </OpenChoreoEntityLayout>
);

const dataplanePage = (
  <OpenChoreoEntityLayout
    contextMenuOptions={{ disableUnregister: 'hidden' }}
    parentEntityRelations={['partOf']}
    kindDisplayNames={PLATFORM_KIND_DISPLAY_NAMES}
  >
    <OpenChoreoEntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3} alignItems="stretch">
        {entityWarningContent}
        {/* Row 1: Status + Hosted Environments */}
        <Grid item md={6} xs={12}>
          <DataplaneStatusCard />
        </Grid>
        <Grid item md={6} xs={12}>
          <DataplaneEnvironmentsCard />
        </Grid>
        {/* Row 2: About + Catalog Graph */}
        <Grid item md={6} xs={12}>
          <EntityAboutCard variant="gridItem" />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard
            variant="gridItem"
            height={400}
            relations={[
              RELATION_PART_OF,
              RELATION_HAS_PART,
              RELATION_HOSTED_ON,
              RELATION_HOSTS,
              RELATION_OBSERVED_BY,
              RELATION_OBSERVES,
            ]}
            renderNode={CustomGraphNode}
          />
        </Grid>
      </Grid>
    </OpenChoreoEntityLayout.Route>
    <OpenChoreoEntityLayout.Route path="/definition" title="Definition">
      <ResourceDefinitionTab />
    </OpenChoreoEntityLayout.Route>
  </OpenChoreoEntityLayout>
);

const clusterDataplanePage = (
  <OpenChoreoEntityLayout
    contextMenuOptions={{ disableUnregister: 'hidden' }}
    kindDisplayNames={PLATFORM_KIND_DISPLAY_NAMES}
  >
    <OpenChoreoEntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3} alignItems="stretch">
        {entityWarningContent}
        {/* Row 1: Status + Hosted Environments */}
        <Grid item md={6} xs={12}>
          <ClusterDataplaneStatusCard />
        </Grid>
        <Grid item md={6} xs={12}>
          <ClusterDataplaneEnvironmentsCard />
        </Grid>
        {/* Row 2: About + Catalog Graph */}
        <Grid item md={6} xs={12}>
          <EntityAboutCard variant="gridItem" />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard
            variant="gridItem"
            height={400}
            relations={[
              RELATION_HOSTED_ON,
              RELATION_HOSTS,
              RELATION_OBSERVED_BY,
              RELATION_OBSERVES,
            ]}
            renderNode={CustomGraphNode}
          />
        </Grid>
      </Grid>
    </OpenChoreoEntityLayout.Route>
    <OpenChoreoEntityLayout.Route path="/definition" title="Definition">
      <ResourceDefinitionTab />
    </OpenChoreoEntityLayout.Route>
  </OpenChoreoEntityLayout>
);

const buildPlanePage = (
  <OpenChoreoEntityLayout
    contextMenuOptions={{ disableUnregister: 'hidden' }}
    parentEntityRelations={['partOf']}
    kindDisplayNames={PLATFORM_KIND_DISPLAY_NAMES}
  >
    <OpenChoreoEntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3} alignItems="stretch">
        {entityWarningContent}
        {/* Row 1: Status + Relations */}
        <Grid item md={6} xs={12}>
          <BuildPlaneStatusCard />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard
            variant="gridItem"
            height={400}
            relations={[
              RELATION_PART_OF,
              RELATION_HAS_PART,
              RELATION_OBSERVED_BY,
              RELATION_OBSERVES,
            ]}
            renderNode={CustomGraphNode}
          />
        </Grid>
        {/* Row 2: About */}
        <Grid item md={12} xs={12}>
          <EntityAboutCard variant="gridItem" />
        </Grid>
      </Grid>
    </OpenChoreoEntityLayout.Route>
    <OpenChoreoEntityLayout.Route path="/definition" title="Definition">
      <ResourceDefinitionTab />
    </OpenChoreoEntityLayout.Route>
  </OpenChoreoEntityLayout>
);

const clusterBuildPlanePage = (
  <OpenChoreoEntityLayout
    contextMenuOptions={{ disableUnregister: 'hidden' }}
    kindDisplayNames={PLATFORM_KIND_DISPLAY_NAMES}
  >
    <OpenChoreoEntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3} alignItems="stretch">
        {entityWarningContent}
        <Grid item md={6} xs={12}>
          <ClusterBuildPlaneStatusCard />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard
            variant="gridItem"
            height={400}
            relations={[RELATION_OBSERVED_BY, RELATION_OBSERVES]}
            renderNode={CustomGraphNode}
          />
        </Grid>
        <Grid item md={12} xs={12}>
          <EntityAboutCard variant="gridItem" />
        </Grid>
      </Grid>
    </OpenChoreoEntityLayout.Route>
    <OpenChoreoEntityLayout.Route path="/definition" title="Definition">
      <ResourceDefinitionTab />
    </OpenChoreoEntityLayout.Route>
  </OpenChoreoEntityLayout>
);

const observabilityPlanePage = (
  <OpenChoreoEntityLayout
    contextMenuOptions={{ disableUnregister: 'hidden' }}
    parentEntityRelations={['partOf']}
    kindDisplayNames={PLATFORM_KIND_DISPLAY_NAMES}
  >
    <OpenChoreoEntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3} alignItems="stretch">
        {entityWarningContent}
        {/* Row 1: Status + Linked Planes */}
        <Grid item md={6} xs={12}>
          <ObservabilityPlaneStatusCard />
        </Grid>
        <Grid item md={6} xs={12}>
          <ObservabilityPlaneLinkedPlanesCard />
        </Grid>
        {/* Row 2: About + Catalog Graph */}
        <Grid item md={6} xs={12}>
          <EntityAboutCard variant="gridItem" />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard
            variant="gridItem"
            height={400}
            relations={[
              RELATION_PART_OF,
              RELATION_HAS_PART,
              RELATION_OBSERVED_BY,
              RELATION_OBSERVES,
            ]}
            unidirectional={false}
            renderNode={CustomGraphNode}
          />
        </Grid>
      </Grid>
    </OpenChoreoEntityLayout.Route>
    <OpenChoreoEntityLayout.Route path="/definition" title="Definition">
      <ResourceDefinitionTab />
    </OpenChoreoEntityLayout.Route>
  </OpenChoreoEntityLayout>
);

const clusterObservabilityPlanePage = (
  <OpenChoreoEntityLayout
    contextMenuOptions={{ disableUnregister: 'hidden' }}
    kindDisplayNames={PLATFORM_KIND_DISPLAY_NAMES}
  >
    <OpenChoreoEntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3} alignItems="stretch">
        {entityWarningContent}
        {/* Row 1: Status + Linked Planes */}
        <Grid item md={6} xs={12}>
          <ClusterObservabilityPlaneStatusCard />
        </Grid>
        <Grid item md={6} xs={12}>
          <ClusterObservabilityPlaneLinkedPlanesCard />
        </Grid>
        {/* Row 2: About + Catalog Graph */}
        <Grid item md={6} xs={12}>
          <EntityAboutCard variant="gridItem" />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard
            variant="gridItem"
            height={400}
            relations={[RELATION_OBSERVED_BY, RELATION_OBSERVES]}
            renderNode={CustomGraphNode}
          />
        </Grid>
      </Grid>
    </OpenChoreoEntityLayout.Route>
    <OpenChoreoEntityLayout.Route path="/definition" title="Definition">
      <ResourceDefinitionTab />
    </OpenChoreoEntityLayout.Route>
  </OpenChoreoEntityLayout>
);

const deploymentPipelinePage = (
  <OpenChoreoEntityLayout
    contextMenuOptions={{ disableUnregister: 'hidden' }}
    parentEntityRelations={['partOf']}
    kindDisplayNames={PLATFORM_KIND_DISPLAY_NAMES}
  >
    <OpenChoreoEntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3} alignItems="stretch">
        {entityWarningContent}
        {/* Row 1: Pipeline Visualization + Promotion Paths (side by side) */}
        <Grid item md={6} xs={12}>
          <DeploymentPipelineVisualization />
        </Grid>
        <Grid item md={6} xs={12}>
          <PromotionPathsCard />
        </Grid>
        {/* Row 2: About + Catalog Graph */}
        <Grid item md={6} xs={12}>
          <EntityAboutCard variant="gridItem" />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard
            variant="gridItem"
            height={400}
            relations={[
              RELATION_PART_OF,
              RELATION_HAS_PART,
              RELATION_PROMOTES_TO,
              RELATION_PROMOTED_BY,
              RELATION_USES_PIPELINE,
              RELATION_PIPELINE_USED_BY,
            ]}
            renderNode={CustomGraphNode}
          />
        </Grid>
      </Grid>
    </OpenChoreoEntityLayout.Route>
    <OpenChoreoEntityLayout.Route path="/definition" title="Definition">
      <ResourceDefinitionTab />
    </OpenChoreoEntityLayout.Route>
  </OpenChoreoEntityLayout>
);

const componentTypePage = (
  <OpenChoreoEntityLayout
    contextMenuOptions={{ disableUnregister: 'hidden' }}
    parentEntityRelations={['partOf']}
    kindDisplayNames={PLATFORM_KIND_DISPLAY_NAMES}
  >
    <OpenChoreoEntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3} alignItems="stretch">
        {entityWarningContent}
        <Grid item md={6} xs={12}>
          <ComponentTypeOverviewCard />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard
            variant="gridItem"
            height={400}
            renderNode={CustomGraphNode}
          />
        </Grid>
        <Grid item md={12} xs={12}>
          <EntityAboutCard variant="gridItem" />
        </Grid>
      </Grid>
    </OpenChoreoEntityLayout.Route>
    <OpenChoreoEntityLayout.Route path="/definition" title="Definition">
      <ResourceDefinitionTab />
    </OpenChoreoEntityLayout.Route>
  </OpenChoreoEntityLayout>
);

const traitTypePage = (
  <OpenChoreoEntityLayout
    contextMenuOptions={{ disableUnregister: 'hidden' }}
    parentEntityRelations={['partOf']}
    kindDisplayNames={PLATFORM_KIND_DISPLAY_NAMES}
  >
    <OpenChoreoEntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3} alignItems="stretch">
        {entityWarningContent}
        <Grid item md={6} xs={12}>
          <TraitTypeOverviewCard />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard
            variant="gridItem"
            height={400}
            renderNode={CustomGraphNode}
          />
        </Grid>
        <Grid item md={12} xs={12}>
          <EntityAboutCard variant="gridItem" />
        </Grid>
      </Grid>
    </OpenChoreoEntityLayout.Route>
    <OpenChoreoEntityLayout.Route path="/definition" title="Definition">
      <ResourceDefinitionTab />
    </OpenChoreoEntityLayout.Route>
  </OpenChoreoEntityLayout>
);

const clusterComponentTypePage = (
  <OpenChoreoEntityLayout
    contextMenuOptions={{ disableUnregister: 'hidden' }}
    kindDisplayNames={PLATFORM_KIND_DISPLAY_NAMES}
  >
    <OpenChoreoEntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3} alignItems="stretch">
        {entityWarningContent}
        <Grid item md={6} xs={12}>
          <ComponentTypeOverviewCard />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard
            variant="gridItem"
            height={400}
            renderNode={CustomGraphNode}
          />
        </Grid>
        <Grid item md={12} xs={12}>
          <EntityAboutCard variant="gridItem" />
        </Grid>
      </Grid>
    </OpenChoreoEntityLayout.Route>
    <OpenChoreoEntityLayout.Route path="/definition" title="Definition">
      <ResourceDefinitionTab />
    </OpenChoreoEntityLayout.Route>
  </OpenChoreoEntityLayout>
);

const clusterTraitTypePage = (
  <OpenChoreoEntityLayout
    contextMenuOptions={{ disableUnregister: 'hidden' }}
    kindDisplayNames={PLATFORM_KIND_DISPLAY_NAMES}
  >
    <OpenChoreoEntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3} alignItems="stretch">
        {entityWarningContent}
        <Grid item md={6} xs={12}>
          <TraitTypeOverviewCard />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard
            variant="gridItem"
            height={400}
            renderNode={CustomGraphNode}
          />
        </Grid>
        <Grid item md={12} xs={12}>
          <EntityAboutCard variant="gridItem" />
        </Grid>
      </Grid>
    </OpenChoreoEntityLayout.Route>
    <OpenChoreoEntityLayout.Route path="/definition" title="Definition">
      <ResourceDefinitionTab />
    </OpenChoreoEntityLayout.Route>
  </OpenChoreoEntityLayout>
);

const workflowPage = (
  <OpenChoreoEntityLayout
    contextMenuOptions={{ disableUnregister: 'hidden' }}
    parentEntityRelations={['partOf']}
    kindDisplayNames={PLATFORM_KIND_DISPLAY_NAMES}
  >
    <OpenChoreoEntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3} alignItems="stretch">
        {entityWarningContent}
        <Grid item md={6} xs={12}>
          <WorkflowOverviewCard />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard
            variant="gridItem"
            height={400}
            renderNode={CustomGraphNode}
          />
        </Grid>
        <Grid item md={12} xs={12}>
          <EntityAboutCard variant="gridItem" />
        </Grid>
      </Grid>
    </OpenChoreoEntityLayout.Route>
    <OpenChoreoEntityLayout.Route path="/definition" title="Definition">
      <ResourceDefinitionTab />
    </OpenChoreoEntityLayout.Route>
    <OpenChoreoEntityLayout.Route path="/runs" title="Runs">
      <EntityNamespaceProvider>
        <WorkflowRunsContent />
      </EntityNamespaceProvider>
    </OpenChoreoEntityLayout.Route>
  </OpenChoreoEntityLayout>
);

const componentWorkflowPage = (
  <OpenChoreoEntityLayout
    contextMenuOptions={{ disableUnregister: 'hidden' }}
    parentEntityRelations={['partOf']}
    kindDisplayNames={PLATFORM_KIND_DISPLAY_NAMES}
  >
    <OpenChoreoEntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3} alignItems="stretch">
        {entityWarningContent}
        <Grid item md={6} xs={12}>
          <ComponentWorkflowOverviewCard />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard
            variant="gridItem"
            height={400}
            relations={[
              RELATION_PART_OF,
              RELATION_HAS_PART,
              RELATION_USES_WORKFLOW,
              RELATION_WORKFLOW_USED_BY,
            ]}
            renderNode={CustomGraphNode}
          />
        </Grid>
        <Grid item md={12} xs={12}>
          <EntityAboutCard variant="gridItem" />
        </Grid>
      </Grid>
    </OpenChoreoEntityLayout.Route>
    <OpenChoreoEntityLayout.Route path="/definition" title="Definition">
      <ResourceDefinitionTab />
    </OpenChoreoEntityLayout.Route>
  </OpenChoreoEntityLayout>
);

export const entityPage = (
  <EntitySwitch>
    <EntitySwitch.Case if={isKind('component')} children={componentPage} />
    <EntitySwitch.Case if={isKind('api')} children={apiPage} />
    <EntitySwitch.Case if={isKind('group')} children={groupPage} />
    <EntitySwitch.Case if={isKind('user')} children={userPage} />
    <EntitySwitch.Case if={isKind('system')} children={systemPage} />
    <EntitySwitch.Case if={isKind('domain')} children={domainPage} />
    <EntitySwitch.Case if={isKind('resource')} children={resourcePage} />
    <EntitySwitch.Case if={isKind('environment')} children={environmentPage} />
    <EntitySwitch.Case if={isKind('dataplane')} children={dataplanePage} />
    <EntitySwitch.Case if={isKind('clusterdataplane')}>
      {clusterDataplanePage}
    </EntitySwitch.Case>
    <EntitySwitch.Case if={isKind('buildplane')}>
      {buildPlanePage}
    </EntitySwitch.Case>
    <EntitySwitch.Case if={isKind('clusterbuildplane')}>
      {clusterBuildPlanePage}
    </EntitySwitch.Case>
    <EntitySwitch.Case if={isKind('observabilityplane')}>
      {observabilityPlanePage}
    </EntitySwitch.Case>
    <EntitySwitch.Case if={isKind('clusterobservabilityplane')}>
      {clusterObservabilityPlanePage}
    </EntitySwitch.Case>
    <EntitySwitch.Case
      if={isKind('deploymentpipeline')}
      children={deploymentPipelinePage}
    />
    <EntitySwitch.Case
      if={isKind('componenttype')}
      children={componentTypePage}
    />
    <EntitySwitch.Case
      if={isKind('clustercomponenttype')}
      children={clusterComponentTypePage}
    />
    <EntitySwitch.Case if={isKind('traittype')} children={traitTypePage} />
    <EntitySwitch.Case
      if={isKind('clustertraittype')}
      children={clusterTraitTypePage}
    />
    <EntitySwitch.Case if={isKind('workflow')} children={workflowPage} />
    <EntitySwitch.Case
      if={isKind('componentworkflow')}
      children={componentWorkflowPage}
    />

    <EntitySwitch.Case>{defaultEntityPage}</EntitySwitch.Case>
  </EntitySwitch>
);
