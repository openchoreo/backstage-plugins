import { Grid } from '@material-ui/core';
import {
  EntityConsumedApisCard,
  EntityConsumingComponentsCard,
  EntityProvidedApisCard,
  EntityProvidingComponentsCard,
} from '@backstage/plugin-api-docs';
import { ApiRawDefinitionCard } from './ApiDefinitionTabs';
import {
  EntityAboutCard,
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
} from '@backstage/plugin-catalog';
import { EntityRelationWarning } from './EntityRelationWarning';
import { OpenChoreoAboutCard } from './OpenChoreoAboutCard';
import {
  CHOREO_LABELS,
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
import { Direction } from '@backstage/plugin-catalog-graph';
import { ContainedCatalogGraphCard as EntityCatalogGraphCard } from './ContainedCatalogGraphCard';
import {
  ApiEntity,
  ComponentEntity,
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
import { TableColumn } from '@backstage/core-components';
import { EntityTable, useEntity } from '@backstage/plugin-catalog-react';
import {
  RELATION_DEPLOYS_TO,
  RELATION_DEPLOYED_BY,
  RELATION_USES_PIPELINE,
  RELATION_PIPELINE_USED_BY,
  RELATION_HOSTED_ON,
  RELATION_HOSTS,
  RELATION_OBSERVED_BY,
  RELATION_OBSERVES,
  RELATION_NOTIFIES,
  RELATION_NOTIFIED_BY,
  RELATION_USES_WORKFLOW,
  RELATION_WORKFLOW_USED_BY,
  RELATION_BUILDS_ON,
  RELATION_BUILDS,
} from '@openchoreo/backstage-plugin-common';

import { TechDocsAddons } from '@backstage/plugin-techdocs-react';
import { ReportIssue } from '@backstage/plugin-techdocs-module-addons-contrib';

import {
  EntityKubernetesContent,
  isKubernetesAvailable,
} from '@backstage/plugin-kubernetes';

import {
  Environments,
  type RenderInvestigateAction,
  CellDiagram,
  DeploymentStatusCard,
  RuntimeHealthCard,
  DeploymentPipelineCard,
  ProjectContentsCard,
  NamespaceProjectsCard,
  NamespaceResourcesCard,
  EnvironmentStatusSummaryCard,
  EnvironmentDeployedComponentsCard,
  EnvironmentPromotionCard,
  EnvironmentGatewayConfigurationCard,
  DataplaneStatusCard,
  DataplaneEnvironmentsCard,
  DataplaneGatewayConfigurationCard,
  NotificationChannelConfigCard,
  ClusterDataplaneStatusCard,
  ClusterDataplaneEnvironmentsCard,
  ClusterDataplaneGatewayConfigurationCard,
  WorkflowPlaneStatusCard,
  ClusterWorkflowPlaneStatusCard,
  ObservabilityPlaneStatusCard,
  ObservabilityPlaneLinkedPlanesCard,
  ClusterObservabilityPlaneStatusCard,
  ClusterObservabilityPlaneLinkedPlanesCard,
  DeploymentPipelineVisualization,
  PromotionPathsCard,
  ComponentTypeOverviewCard,
  ResourceTypeOverviewCard,
  ProjectTypeOverviewCard,
  ResourceParametersCard,
  ResourceDeploymentsCard,
  ConsumingComponentsCard,
  TraitTypeOverviewCard,
  WorkflowOverviewCard,
  ComponentWorkflowOverviewCard,
  ResourceDefinitionTab,
  ResourceEnvironments,
  ProjectEnvironments,
  ApiTryOut,
} from '@openchoreo/backstage-plugin';
import { EntityLayoutWithDelete } from './EntityLayoutWithDelete';

import { Workflows } from '@openchoreo/backstage-plugin-openchoreo-ci';
import {
  FailedBuildSnackbar,
  InvestigateLogButton,
  InvestigateDependencyButton,
} from '@openchoreo/backstage-plugin-openchoreo-portal-assistant';
import {
  WorkflowRunsContent,
  EntityNamespaceProvider,
} from '@openchoreo/backstage-plugin-openchoreo-workflows';

import {
  ObservabilityMetrics,
  ObservabilityTraces,
  ObservabilityRCA,
  ObservabilityRuntimeLogs,
  ObservabilityRuntimeEvents,
  ObservabilityProjectRuntimeLogs,
  ObservabilityAlerts,
  ObservabilityWirelogs,
  ObservabilityProjectIncidents,
  ObservabilityCostAnalysis,
  useComponentHasAnyCiliumEnabledEnvironment,
  type RenderLogRowAction,
} from '@openchoreo/backstage-plugin-openchoreo-observability';

import {
  FeatureGate,
  FeatureGatedContent,
  CustomGraphNode,
  OpenChoreoEntityLayout,
} from '@openchoreo/backstage-plugin-react';
import { WorkflowsOrExternalCICard } from './WorkflowsOrExternalCICard';

// External CI Platform imports
import { EntityJenkinsContent } from '@backstage-community/plugin-jenkins';
import { EntityGithubActionsContent } from '@backstage-community/plugin-github-actions';
import { EntityGitlabContent } from '@immobiliarelabs/backstage-plugin-gitlab';

// Wires perch's per-row assistant button into the observability log
// tables via the plugin's render-prop slot. Lives here (not inside the
// observability plugin) so observability owns no dependency on perch —
// the shell composes the two.
const renderInvestigateLogAction: RenderLogRowAction = (
  log,
  getLogsSnapshot,
) => <InvestigateLogButton log={log} getLogsSnapshot={getLogsSnapshot} />;

// Same pattern for the deploy panel: the openchoreo plugin exposes a
// render-prop slot for a status-aware "Investigate with AI" button and the
// shell injects perch's button here, so the openchoreo plugin owns no
// dependency on perch.
const renderInvestigateDependencyAction: RenderInvestigateAction = scope => (
  <InvestigateDependencyButton {...scope} />
);

const PLATFORM_KIND_DISPLAY_NAMES: Record<string, string> = {
  domain: 'Namespace',
  dataplane: 'Dataplane',
  clusterdataplane: 'Cluster Data Plane',
  workflowplane: 'Workflow Plane',
  clusterworkflowplane: 'Cluster Workflow Plane',
  observabilityplane: 'Observability Plane',
  clusterobservabilityplane: 'Cluster Observability Plane',
  environment: 'Environment',
  observabilityalertsnotificationchannel: 'Notification Channel',
  deploymentpipeline: 'Deployment Pipeline',
  componenttype: 'Component Type',
  resourcetype: 'Resource Type',
  projecttype: 'Project Type',
  clustercomponenttype: 'Cluster Component Type',
  clusterresourcetype: 'Cluster Resource Type',
  clusterprojecttype: 'Cluster Project Type',
  traittype: 'Trait Type',
  clustertraittype: 'Cluster Trait Type',
  workflow: 'Workflow',
  clusterworkflow: 'Cluster Workflow',
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

const hasApis = (entity: Entity) =>
  Boolean(
    entity.relations?.some(
      r => r.type === RELATION_PROVIDES_API || r.type === RELATION_CONSUMES_API,
    ),
  );

const hasTechdocsAnnotation = (entity: Entity) =>
  Boolean(entity.metadata.annotations?.['backstage.io/techdocs-ref']);

/** Custom columns for API cards: no Owner, System renamed to Project */
const apiCardColumns: TableColumn<ApiEntity>[] = [
  EntityTable.columns.createEntityRefColumn({ defaultKind: 'API' }),
  EntityTable.columns.createEntityRelationColumn({
    title: 'Project',
    relation: RELATION_PART_OF,
    defaultKind: 'system',
    filter: { kind: 'system' },
  }),
  EntityTable.columns.createSpecTypeColumn(),
  EntityTable.columns.createMetadataDescriptionColumn(),
];

/** Custom columns for component cards on API page: no Owner/Lifecycle, System renamed to Project */
const componentCardColumns: TableColumn<ComponentEntity>[] = [
  EntityTable.columns.createEntityRefColumn({ defaultKind: 'component' }),
  EntityTable.columns.createEntityRelationColumn({
    title: 'Project',
    relation: RELATION_PART_OF,
    defaultKind: 'system',
    filter: { kind: 'system' },
  }),
  EntityTable.columns.createSpecTypeColumn(),
  EntityTable.columns.createMetadataDescriptionColumn(),
];

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
          {/* Failed-build prompt — renders nothing unless the latest run is in
              a failed state. Sits inside the EntitySwitch so it inherits the
              entity context and only mounts on component pages. */}
          <FailedBuildSnackbar />
          {/* CI Status Card - shows external CI card if annotation present, otherwise OpenChoreo WorkflowsOverviewCard */}
          <WorkflowsOrExternalCICard />
          <Grid item md={4} xs={12}>
            <DeploymentStatusCard />
          </Grid>
          <FeatureGate feature="observability">
            <Grid item md={4} xs={12}>
              <RuntimeHealthCard />
            </Grid>
          </FeatureGate>
        </EntitySwitch.Case>
      </EntitySwitch>
      <EntitySwitch>
        <EntitySwitch.Case if={isKind('component')}>
          <Grid item md={6} xs={12}>
            <OpenChoreoAboutCard variant="gridItem" showEditIcon />
          </Grid>
        </EntitySwitch.Case>
        <EntitySwitch.Case>
          <Grid item md={6} xs={12}>
            <EntityAboutCard />
          </Grid>
        </EntitySwitch.Case>
      </EntitySwitch>
      <Grid item md={6} xs={12}>
        <EntityCatalogGraphCard height={400} renderNode={CustomGraphNode} />
      </Grid>
    </Grid>
  );
}

/**
 * Service entity page with delete menu support.
 * Routes are defined as static JSX children so routable extensions are discoverable.
 */
const ServiceEntityPage = () => {
  const { entity } = useEntity();
  const hasAnyCiliumEnabledEnvironment =
    useComponentHasAnyCiliumEnabledEnvironment(entity);

  return (
    <EntityLayoutWithDelete>
      <EntityLayout.Route path="/" title="Overview">
        <OverviewContent />
      </EntityLayout.Route>

      <EntityLayout.Route path="/definition" title="Definition">
        <ResourceDefinitionTab />
      </EntityLayout.Route>

      <EntityLayout.Route path="/workflows" title="Build">
        <FeatureGatedContent feature="workflows">
          {/* Auto-popping launcher — renders nothing unless the latest
            run is in a failed state. The fixed pill on this tab was
            intentionally removed; the snackbar still fires so a user
            opening a failed build gets an "Investigate" prompt. */}
          <FailedBuildSnackbar />
          <Workflows />
        </FeatureGatedContent>
      </EntityLayout.Route>

      <EntityLayout.Route path="/environments" title="Deploy">
        <Environments
          renderInvestigateAction={renderInvestigateDependencyAction}
        />
      </EntityLayout.Route>

      <EntityLayout.Route path="/runtime-logs" title="Logs">
        <FeatureGatedContent feature="observability">
          <ObservabilityRuntimeLogs
            renderRowAction={renderInvestigateLogAction}
          />
        </FeatureGatedContent>
      </EntityLayout.Route>

      <EntityLayout.Route path="/runtime-events" title="Events">
        <FeatureGatedContent feature="observability">
          <ObservabilityRuntimeEvents />
        </FeatureGatedContent>
      </EntityLayout.Route>

      <EntityLayout.Route path="/metrics" title="Metrics">
        <FeatureGatedContent feature="observability">
          <ObservabilityMetrics />
        </FeatureGatedContent>
      </EntityLayout.Route>

      <EntityLayout.Route path="/alerts" title="Alerts">
        <FeatureGatedContent feature="observability">
          <ObservabilityAlerts />
        </FeatureGatedContent>
      </EntityLayout.Route>

      <EntityLayout.Route
        path="/wirelogs"
        title="Wirelogs"
        if={() => hasAnyCiliumEnabledEnvironment}
      >
        <FeatureGatedContent feature="observability">
          <ObservabilityWirelogs />
        </FeatureGatedContent>
      </EntityLayout.Route>

      <EntityLayout.Route
        path="/kubernetes"
        title="Kubernetes"
        if={isKubernetesAvailable}
      >
        <EntityKubernetesContent />
      </EntityLayout.Route>

      <EntityLayout.Route path="/api" title="API" if={hasApis}>
        <Grid container spacing={3} alignItems="stretch">
          <Grid item md={6}>
            <EntityProvidedApisCard columns={apiCardColumns} />
          </Grid>
          <Grid item md={6}>
            <EntityConsumedApisCard columns={apiCardColumns} />
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

      <EntityLayout.Route
        path="/gitlab"
        title="GitLab"
        if={hasGitlabAnnotation}
      >
        <EntityGitlabContent />
      </EntityLayout.Route>
    </EntityLayoutWithDelete>
  );
};

/**
 * Website entity page with delete menu support.
 * Routes are defined as static JSX children so routable extensions are discoverable.
 */
const GenericComponentEntityPage = () => {
  const { entity } = useEntity();
  const hasAnyCiliumEnabledEnvironment =
    useComponentHasAnyCiliumEnabledEnvironment(entity);

  return (
    <EntityLayoutWithDelete>
      <EntityLayout.Route path="/" title="Overview">
        <OverviewContent />
      </EntityLayout.Route>

      <EntityLayout.Route path="/definition" title="Definition">
        <ResourceDefinitionTab />
      </EntityLayout.Route>

      <EntityLayout.Route path="/workflows" title="Build">
        <FeatureGatedContent feature="workflows">
          {/* Auto-popping launcher — renders nothing unless the latest
            run is in a failed state. The fixed pill on this tab was
            intentionally removed; the snackbar still fires so a user
            opening a failed build gets an "Investigate" prompt. */}
          <FailedBuildSnackbar />
          <Workflows />
        </FeatureGatedContent>
      </EntityLayout.Route>

      <EntityLayout.Route path="/environments" title="Deploy">
        <Environments
          renderInvestigateAction={renderInvestigateDependencyAction}
        />
      </EntityLayout.Route>

      <EntityLayout.Route path="/runtime-logs" title="Logs">
        <FeatureGatedContent feature="observability">
          <ObservabilityRuntimeLogs
            renderRowAction={renderInvestigateLogAction}
          />
        </FeatureGatedContent>
      </EntityLayout.Route>

      <EntityLayout.Route path="/runtime-events" title="Events">
        <FeatureGatedContent feature="observability">
          <ObservabilityRuntimeEvents />
        </FeatureGatedContent>
      </EntityLayout.Route>

      <EntityLayout.Route path="/metrics" title="Metrics">
        <FeatureGatedContent feature="observability">
          <ObservabilityMetrics />
        </FeatureGatedContent>
      </EntityLayout.Route>

      <EntityLayout.Route path="/alerts" title="Alerts">
        <FeatureGatedContent feature="observability">
          <ObservabilityAlerts />
        </FeatureGatedContent>
      </EntityLayout.Route>

      <EntityLayout.Route
        path="/wirelogs"
        title="Wirelogs"
        if={() => hasAnyCiliumEnabledEnvironment}
      >
        <FeatureGatedContent feature="observability">
          <ObservabilityWirelogs />
        </FeatureGatedContent>
      </EntityLayout.Route>

      <EntityLayout.Route
        path="/kubernetes"
        title="Kubernetes"
        if={isKubernetesAvailable}
      >
        <EntityKubernetesContent />
      </EntityLayout.Route>

      <EntityLayout.Route path="/api" title="API" if={hasApis}>
        <Grid container spacing={3} alignItems="stretch">
          <Grid item md={6}>
            <EntityProvidedApisCard columns={apiCardColumns} />
          </Grid>
          <Grid item md={6}>
            <EntityConsumedApisCard columns={apiCardColumns} />
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

      <EntityLayout.Route
        path="/gitlab"
        title="GitLab"
        if={hasGitlabAnnotation}
      >
        <EntityGitlabContent />
      </EntityLayout.Route>
    </EntityLayoutWithDelete>
  );
};

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
      <ServiceEntityPage />
    </EntitySwitch.Case>

    <EntitySwitch.Case if={isGenericComponent}>
      <GenericComponentEntityPage />
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
          <EntityProvidingComponentsCard columns={componentCardColumns} />
        </Grid>
        <Grid item md={6}>
          <EntityConsumingComponentsCard columns={componentCardColumns} />
        </Grid>
        <Grid item md={6}>
          <EntityAboutCard />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard height={400} renderNode={CustomGraphNode} />
        </Grid>
      </Grid>
    </EntityLayout.Route>

    <EntityLayout.Route path="/definition" title="Definition">
      <ApiRawDefinitionCard />
    </EntityLayout.Route>

    <EntityLayout.Route path="/try-out" title="Try Out">
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <ApiTryOut />
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
          <EntityUserProfileCard />
        </Grid>
        <Grid item xs={12} md={6}>
          <EntityOwnershipCard />
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
          <EntityGroupProfileCard />
        </Grid>
        <Grid item xs={12} md={6}>
          <EntityOwnershipCard />
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
        {/* Row 1: Project Contents (components + resources), full width */}
        <Grid item xs={12}>
          <ProjectContentsCard />
        </Grid>

        {/* Row 2: Deployment Pipeline + About */}
        <Grid item md={6} xs={12}>
          <DeploymentPipelineCard />
        </Grid>
        <Grid item md={6} xs={12}>
          <OpenChoreoAboutCard variant="gridItem" showEditIcon />
        </Grid>

        {/* Row 3: Catalog Relations, full width */}
        <Grid item xs={12}>
          <EntityCatalogGraphCard height={400} renderNode={CustomGraphNode} />
        </Grid>
      </Grid>
    </EntityLayout.Route>
    <EntityLayout.Route path="/definition" title="Definition">
      <ResourceDefinitionTab />
    </EntityLayout.Route>
    <EntityLayout.Route path="/deploy" title="Deploy">
      <ProjectEnvironments />
    </EntityLayout.Route>
    <EntityLayout.Route path="/cell-diagram" title="Cell Diagram">
      <CellDiagram />
    </EntityLayout.Route>
    <EntityLayout.Route path="/diagram" title="Diagram">
      <EntityCatalogGraphCard
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
    <EntityLayout.Route path="/logs" title="Logs">
      <FeatureGatedContent feature="observability">
        <ObservabilityProjectRuntimeLogs
          renderRowAction={renderInvestigateLogAction}
        />
      </FeatureGatedContent>
    </EntityLayout.Route>
    <EntityLayout.Route path="/traces" title="Traces">
      <FeatureGatedContent feature="observability">
        <ObservabilityTraces />
      </FeatureGatedContent>
    </EntityLayout.Route>
    <EntityLayout.Route path="/incidents" title="Incidents">
      <FeatureGatedContent feature="observability">
        <ObservabilityProjectIncidents />
      </FeatureGatedContent>
    </EntityLayout.Route>
    <EntityLayout.Route path="/rca-reports" title="RCA Reports">
      <FeatureGatedContent feature="observability">
        <ObservabilityRCA />
      </FeatureGatedContent>
    </EntityLayout.Route>
    <EntityLayout.Route path="/cost-analysis" title="Cost Analysis">
      <FeatureGatedContent feature="observability">
        <ObservabilityCostAnalysis />
      </FeatureGatedContent>
    </EntityLayout.Route>
  </EntityLayoutWithDelete>
);

/**
 * Domain page. Uses OpenChoreoEntityLayout with kindDisplayNames
 * to show "Namespace" instead of "Domain" for OpenChoreo domains.
 */
const domainPage = (
  <EntityLayoutWithDelete kindDisplayNames={{ domain: 'Namespace' }}>
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
          <OpenChoreoAboutCard variant="gridItem" showEditIcon />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard
            height={500}
            zoom="enabled"
            maxDepth={1}
            renderNode={CustomGraphNode}
          />
        </Grid>
      </Grid>
    </OpenChoreoEntityLayout.Route>
    <OpenChoreoEntityLayout.Route path="/definition" title="Definition">
      <ResourceDefinitionTab />
    </OpenChoreoEntityLayout.Route>
  </EntityLayoutWithDelete>
);

const defaultResourcePage = (
  <EntityLayout UNSTABLE_contextMenuOptions={{ disableUnregister: 'hidden' }}>
    <EntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3} alignItems="stretch">
        {entityWarningContent}
        <Grid item md={6}>
          <EntityAboutCard />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard height={400} renderNode={CustomGraphNode} />
        </Grid>
        <Grid item md={4} xs={12}>
          <EntityLinksCard />
        </Grid>
        <Grid item md={8}>
          <EntityHasComponentsCard />
        </Grid>
      </Grid>
    </EntityLayout.Route>
  </EntityLayout>
);

const isOpenChoreoResource = (entity: Entity) =>
  entity.metadata.labels?.[CHOREO_LABELS.MANAGED] === 'true';

const openchoreoResourcePage = (
  <EntityLayoutWithDelete>
    <EntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3} alignItems="stretch">
        {entityWarningContent}
        {/* Row 1: Parameters / Deployments / Consuming Components */}
        <Grid item md={4} xs={12}>
          <ResourceParametersCard />
        </Grid>
        <Grid item md={4} xs={12}>
          <ResourceDeploymentsCard />
        </Grid>
        <Grid item md={4} xs={12}>
          <ConsumingComponentsCard />
        </Grid>
        {/* Row 2: About / Relations */}
        <Grid item md={6} xs={12}>
          <OpenChoreoAboutCard variant="gridItem" showEditIcon />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard height={400} renderNode={CustomGraphNode} />
        </Grid>
      </Grid>
    </EntityLayout.Route>
    <EntityLayout.Route path="/definition" title="Definition">
      <ResourceDefinitionTab />
    </EntityLayout.Route>
    <EntityLayout.Route path="/environments" title="Deploy">
      <ResourceEnvironments />
    </EntityLayout.Route>
  </EntityLayoutWithDelete>
);

const resourcePage = (
  <EntitySwitch>
    <EntitySwitch.Case if={isOpenChoreoResource}>
      {openchoreoResourcePage}
    </EntitySwitch.Case>
    <EntitySwitch.Case>{defaultResourcePage}</EntitySwitch.Case>
  </EntitySwitch>
);

const environmentPage = (
  <EntityLayoutWithDelete
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
        {/* Row 3: Gateway Configuration */}
        <Grid item xs={12}>
          <EnvironmentGatewayConfigurationCard />
        </Grid>
        {/* Row 4: About + Catalog Graph */}
        <Grid item md={6} xs={12}>
          <OpenChoreoAboutCard variant="gridItem" showEditIcon />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard
            height={400}
            relations={[
              RELATION_PART_OF,
              RELATION_HAS_PART,
              RELATION_DEPLOYS_TO,
              RELATION_DEPLOYED_BY,
              RELATION_HOSTED_ON,
              RELATION_HOSTS,
              RELATION_NOTIFIES,
              RELATION_NOTIFIED_BY,
            ]}
            renderNode={CustomGraphNode}
          />
        </Grid>
      </Grid>
    </OpenChoreoEntityLayout.Route>
    <OpenChoreoEntityLayout.Route path="/definition" title="Definition">
      <ResourceDefinitionTab />
    </OpenChoreoEntityLayout.Route>
  </EntityLayoutWithDelete>
);

const notificationChannelPage = (
  <EntityLayoutWithDelete
    parentEntityRelations={['notifiedBy', 'partOf']}
    kindDisplayNames={PLATFORM_KIND_DISPLAY_NAMES}
  >
    <OpenChoreoEntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3} alignItems="stretch">
        {entityWarningContent}
        <Grid item xs={12}>
          <NotificationChannelConfigCard />
        </Grid>
        <Grid item md={6} xs={12}>
          <OpenChoreoAboutCard variant="gridItem" showEditIcon />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard
            height={400}
            relations={[RELATION_NOTIFIES, RELATION_NOTIFIED_BY]}
            renderNode={CustomGraphNode}
          />
        </Grid>
      </Grid>
    </OpenChoreoEntityLayout.Route>
    <OpenChoreoEntityLayout.Route path="/definition" title="Definition">
      <ResourceDefinitionTab />
    </OpenChoreoEntityLayout.Route>
  </EntityLayoutWithDelete>
);

const dataplanePage = (
  <EntityLayoutWithDelete
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
        {/* Row 2: Gateway Configuration */}
        <Grid item xs={12}>
          <DataplaneGatewayConfigurationCard />
        </Grid>
        {/* Row 3: About + Catalog Graph */}
        <Grid item md={6} xs={12}>
          <OpenChoreoAboutCard variant="gridItem" showEditIcon />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard
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
  </EntityLayoutWithDelete>
);

const clusterDataplanePage = (
  <EntityLayoutWithDelete kindDisplayNames={PLATFORM_KIND_DISPLAY_NAMES}>
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
        {/* Row 2: Gateway Configuration */}
        <Grid item xs={12}>
          <ClusterDataplaneGatewayConfigurationCard />
        </Grid>
        {/* Row 3: About + Catalog Graph */}
        <Grid item md={6} xs={12}>
          <OpenChoreoAboutCard variant="gridItem" showEditIcon />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard
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
  </EntityLayoutWithDelete>
);

const workflowPlanePage = (
  <EntityLayoutWithDelete
    parentEntityRelations={['partOf']}
    kindDisplayNames={PLATFORM_KIND_DISPLAY_NAMES}
  >
    <OpenChoreoEntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3} alignItems="stretch">
        {entityWarningContent}
        {/* Row 1: Status + Relations */}
        <Grid item md={6} xs={12}>
          <WorkflowPlaneStatusCard />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard
            height={400}
            relations={[
              RELATION_PART_OF,
              RELATION_HAS_PART,
              RELATION_OBSERVED_BY,
              RELATION_OBSERVES,
              RELATION_BUILDS_ON,
              RELATION_BUILDS,
            ]}
            renderNode={CustomGraphNode}
          />
        </Grid>
        {/* Row 2: About */}
        <Grid item md={12} xs={12}>
          <OpenChoreoAboutCard variant="gridItem" showEditIcon />
        </Grid>
      </Grid>
    </OpenChoreoEntityLayout.Route>
    <OpenChoreoEntityLayout.Route path="/definition" title="Definition">
      <ResourceDefinitionTab />
    </OpenChoreoEntityLayout.Route>
  </EntityLayoutWithDelete>
);

const clusterWorkflowPlanePage = (
  <EntityLayoutWithDelete kindDisplayNames={PLATFORM_KIND_DISPLAY_NAMES}>
    <OpenChoreoEntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3} alignItems="stretch">
        {entityWarningContent}
        <Grid item md={6} xs={12}>
          <ClusterWorkflowPlaneStatusCard />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard
            height={400}
            relations={[
              RELATION_OBSERVED_BY,
              RELATION_OBSERVES,
              RELATION_BUILDS_ON,
              RELATION_BUILDS,
            ]}
            renderNode={CustomGraphNode}
          />
        </Grid>
        <Grid item md={12} xs={12}>
          <OpenChoreoAboutCard variant="gridItem" showEditIcon />
        </Grid>
      </Grid>
    </OpenChoreoEntityLayout.Route>
    <OpenChoreoEntityLayout.Route path="/definition" title="Definition">
      <ResourceDefinitionTab />
    </OpenChoreoEntityLayout.Route>
  </EntityLayoutWithDelete>
);

const observabilityPlanePage = (
  <EntityLayoutWithDelete
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
          <OpenChoreoAboutCard variant="gridItem" showEditIcon />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard
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
  </EntityLayoutWithDelete>
);

const clusterObservabilityPlanePage = (
  <EntityLayoutWithDelete kindDisplayNames={PLATFORM_KIND_DISPLAY_NAMES}>
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
          <OpenChoreoAboutCard variant="gridItem" showEditIcon />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard
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
  </EntityLayoutWithDelete>
);

const deploymentPipelinePage = (
  <EntityLayoutWithDelete
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
          <OpenChoreoAboutCard variant="gridItem" showEditIcon />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard
            height={400}
            relations={[
              RELATION_PART_OF,
              RELATION_HAS_PART,
              RELATION_DEPLOYS_TO,
              RELATION_DEPLOYED_BY,
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
  </EntityLayoutWithDelete>
);

const componentTypePage = (
  <EntityLayoutWithDelete
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
          <EntityCatalogGraphCard height={400} renderNode={CustomGraphNode} />
        </Grid>
        <Grid item md={12} xs={12}>
          <OpenChoreoAboutCard variant="gridItem" showEditIcon />
        </Grid>
      </Grid>
    </OpenChoreoEntityLayout.Route>
    <OpenChoreoEntityLayout.Route path="/definition" title="Definition">
      <ResourceDefinitionTab />
    </OpenChoreoEntityLayout.Route>
  </EntityLayoutWithDelete>
);

const resourceTypePage = (
  <EntityLayoutWithDelete kindDisplayNames={PLATFORM_KIND_DISPLAY_NAMES}>
    <OpenChoreoEntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3} alignItems="stretch">
        {entityWarningContent}
        <Grid item md={6} xs={12}>
          <ResourceTypeOverviewCard />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard height={400} renderNode={CustomGraphNode} />
        </Grid>
        <Grid item md={12} xs={12}>
          <OpenChoreoAboutCard variant="gridItem" showEditIcon />
        </Grid>
      </Grid>
    </OpenChoreoEntityLayout.Route>
    <OpenChoreoEntityLayout.Route path="/definition" title="Definition">
      <ResourceDefinitionTab />
    </OpenChoreoEntityLayout.Route>
  </EntityLayoutWithDelete>
);

const traitTypePage = (
  <EntityLayoutWithDelete
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
          <EntityCatalogGraphCard height={400} renderNode={CustomGraphNode} />
        </Grid>
        <Grid item md={12} xs={12}>
          <OpenChoreoAboutCard variant="gridItem" showEditIcon />
        </Grid>
      </Grid>
    </OpenChoreoEntityLayout.Route>
    <OpenChoreoEntityLayout.Route path="/definition" title="Definition">
      <ResourceDefinitionTab />
    </OpenChoreoEntityLayout.Route>
  </EntityLayoutWithDelete>
);

const clusterComponentTypePage = (
  <EntityLayoutWithDelete kindDisplayNames={PLATFORM_KIND_DISPLAY_NAMES}>
    <OpenChoreoEntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3} alignItems="stretch">
        {entityWarningContent}
        <Grid item md={6} xs={12}>
          <ComponentTypeOverviewCard />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard height={400} renderNode={CustomGraphNode} />
        </Grid>
        <Grid item md={12} xs={12}>
          <OpenChoreoAboutCard variant="gridItem" showEditIcon />
        </Grid>
      </Grid>
    </OpenChoreoEntityLayout.Route>
    <OpenChoreoEntityLayout.Route path="/definition" title="Definition">
      <ResourceDefinitionTab />
    </OpenChoreoEntityLayout.Route>
  </EntityLayoutWithDelete>
);

const clusterResourceTypePage = (
  <EntityLayoutWithDelete kindDisplayNames={PLATFORM_KIND_DISPLAY_NAMES}>
    <OpenChoreoEntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3} alignItems="stretch">
        {entityWarningContent}
        <Grid item md={6} xs={12}>
          <ResourceTypeOverviewCard />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard height={400} renderNode={CustomGraphNode} />
        </Grid>
        <Grid item md={12} xs={12}>
          <OpenChoreoAboutCard variant="gridItem" showEditIcon />
        </Grid>
      </Grid>
    </OpenChoreoEntityLayout.Route>
    <OpenChoreoEntityLayout.Route path="/definition" title="Definition">
      <ResourceDefinitionTab />
    </OpenChoreoEntityLayout.Route>
  </EntityLayoutWithDelete>
);

const projectTypePage = (
  <EntityLayoutWithDelete kindDisplayNames={PLATFORM_KIND_DISPLAY_NAMES}>
    <OpenChoreoEntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3} alignItems="stretch">
        {entityWarningContent}
        <Grid item md={6} xs={12}>
          <ProjectTypeOverviewCard />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard height={400} renderNode={CustomGraphNode} />
        </Grid>
        <Grid item md={12} xs={12}>
          <OpenChoreoAboutCard variant="gridItem" showEditIcon />
        </Grid>
      </Grid>
    </OpenChoreoEntityLayout.Route>
    <OpenChoreoEntityLayout.Route path="/definition" title="Definition">
      <ResourceDefinitionTab />
    </OpenChoreoEntityLayout.Route>
  </EntityLayoutWithDelete>
);

const clusterProjectTypePage = (
  <EntityLayoutWithDelete kindDisplayNames={PLATFORM_KIND_DISPLAY_NAMES}>
    <OpenChoreoEntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3} alignItems="stretch">
        {entityWarningContent}
        <Grid item md={6} xs={12}>
          <ProjectTypeOverviewCard />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard height={400} renderNode={CustomGraphNode} />
        </Grid>
        <Grid item md={12} xs={12}>
          <OpenChoreoAboutCard variant="gridItem" showEditIcon />
        </Grid>
      </Grid>
    </OpenChoreoEntityLayout.Route>
    <OpenChoreoEntityLayout.Route path="/definition" title="Definition">
      <ResourceDefinitionTab />
    </OpenChoreoEntityLayout.Route>
  </EntityLayoutWithDelete>
);

const clusterTraitTypePage = (
  <EntityLayoutWithDelete kindDisplayNames={PLATFORM_KIND_DISPLAY_NAMES}>
    <OpenChoreoEntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3} alignItems="stretch">
        {entityWarningContent}
        <Grid item md={6} xs={12}>
          <TraitTypeOverviewCard />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard height={400} renderNode={CustomGraphNode} />
        </Grid>
        <Grid item md={12} xs={12}>
          <OpenChoreoAboutCard variant="gridItem" showEditIcon />
        </Grid>
      </Grid>
    </OpenChoreoEntityLayout.Route>
    <OpenChoreoEntityLayout.Route path="/definition" title="Definition">
      <ResourceDefinitionTab />
    </OpenChoreoEntityLayout.Route>
  </EntityLayoutWithDelete>
);

const workflowPage = (
  <EntityLayoutWithDelete
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
          <EntityCatalogGraphCard height={400} renderNode={CustomGraphNode} />
        </Grid>
        <Grid item md={12} xs={12}>
          <OpenChoreoAboutCard variant="gridItem" showEditIcon />
        </Grid>
      </Grid>
    </OpenChoreoEntityLayout.Route>
    <OpenChoreoEntityLayout.Route
      path="/runs"
      title="Runs"
      if={entity => (entity.spec as any)?.type === 'Generic'}
    >
      <EntityNamespaceProvider>
        <WorkflowRunsContent />
      </EntityNamespaceProvider>
    </OpenChoreoEntityLayout.Route>
    <OpenChoreoEntityLayout.Route path="/definition" title="Definition">
      <ResourceDefinitionTab />
    </OpenChoreoEntityLayout.Route>
  </EntityLayoutWithDelete>
);

const clusterWorkflowPage = (
  <EntityLayoutWithDelete kindDisplayNames={PLATFORM_KIND_DISPLAY_NAMES}>
    <OpenChoreoEntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3} alignItems="stretch">
        {entityWarningContent}
        <Grid item md={6} xs={12}>
          <WorkflowOverviewCard />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard height={400} renderNode={CustomGraphNode} />
        </Grid>
        <Grid item md={12} xs={12}>
          <OpenChoreoAboutCard variant="gridItem" showEditIcon />
        </Grid>
      </Grid>
    </OpenChoreoEntityLayout.Route>
    <OpenChoreoEntityLayout.Route
      path="/runs"
      title="Runs"
      if={entity => (entity.spec as any)?.type === 'Generic'}
    >
      <EntityNamespaceProvider>
        <WorkflowRunsContent />
      </EntityNamespaceProvider>
    </OpenChoreoEntityLayout.Route>
    <OpenChoreoEntityLayout.Route path="/definition" title="Definition">
      <ResourceDefinitionTab />
    </OpenChoreoEntityLayout.Route>
  </EntityLayoutWithDelete>
);

const componentWorkflowPage = (
  <EntityLayoutWithDelete
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
          <OpenChoreoAboutCard variant="gridItem" showEditIcon />
        </Grid>
      </Grid>
    </OpenChoreoEntityLayout.Route>
    <OpenChoreoEntityLayout.Route path="/definition" title="Definition">
      <ResourceDefinitionTab />
    </OpenChoreoEntityLayout.Route>
  </EntityLayoutWithDelete>
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
    <EntitySwitch.Case
      if={isKind('observabilityalertsnotificationchannel')}
      children={notificationChannelPage}
    />
    <EntitySwitch.Case if={isKind('dataplane')} children={dataplanePage} />
    <EntitySwitch.Case if={isKind('clusterdataplane')}>
      {clusterDataplanePage}
    </EntitySwitch.Case>
    <EntitySwitch.Case if={isKind('workflowplane')}>
      {workflowPlanePage}
    </EntitySwitch.Case>
    <EntitySwitch.Case if={isKind('clusterworkflowplane')}>
      {clusterWorkflowPlanePage}
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
      if={isKind('resourcetype')}
      children={resourceTypePage}
    />
    <EntitySwitch.Case if={isKind('projecttype')} children={projectTypePage} />
    <EntitySwitch.Case
      if={isKind('clustercomponenttype')}
      children={clusterComponentTypePage}
    />
    <EntitySwitch.Case
      if={isKind('clusterresourcetype')}
      children={clusterResourceTypePage}
    />
    <EntitySwitch.Case
      if={isKind('clusterprojecttype')}
      children={clusterProjectTypePage}
    />
    <EntitySwitch.Case if={isKind('traittype')} children={traitTypePage} />
    <EntitySwitch.Case
      if={isKind('clustertraittype')}
      children={clusterTraitTypePage}
    />
    <EntitySwitch.Case if={isKind('workflow')} children={workflowPage} />
    <EntitySwitch.Case if={isKind('clusterworkflow')}>
      {clusterWorkflowPage}
    </EntitySwitch.Case>
    <EntitySwitch.Case
      if={isKind('componentworkflow')}
      children={componentWorkflowPage}
    />

    <EntitySwitch.Case>{defaultEntityPage}</EntitySwitch.Case>
  </EntitySwitch>
);
