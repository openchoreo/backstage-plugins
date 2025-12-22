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
  EntityHasSystemsCard,
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

import { TechDocsAddons } from '@backstage/plugin-techdocs-react';
import { ReportIssue } from '@backstage/plugin-techdocs-module-addons-contrib';

import {
  EntityKubernetesContent,
  isKubernetesAvailable,
} from '@backstage/plugin-kubernetes';

import {
  Environments,
  CellDiagram,
  RuntimeLogs,
  WorkflowsOverviewCard,
  ProductionOverviewCard,
  RuntimeHealthCard,
  DeploymentPipelineCard,
  ProjectComponentsCard,
  Traits,
} from '@openchoreo/backstage-plugin';

import { WorkflowsPage as Workflows } from '@openchoreo/backstage-plugin-openchoreo-ci';

import {
  ObservabilityMetrics,
  ObservabilityTraces,
} from '@openchoreo/backstage-plugin-openchoreo-observability';

import { FeatureGate } from '@openchoreo/backstage-plugin-react';
import { FeatureGatedContent } from './FeatureGatedContent';

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
 * WorkflowsOverviewCard is gated by workflows feature.
 * RuntimeHealthCard is gated by observability feature.
 */
function OverviewContent() {
  return (
    <Grid container spacing={3} alignItems="stretch">
      {entityWarningContent}
      <EntitySwitch>
        <EntitySwitch.Case if={isKind('component')}>
          {/* OpenChoreo Summary Cards - feature gated */}
          <FeatureGate feature="workflows">
            <Grid item md={4} xs={12}>
              <WorkflowsOverviewCard />
            </Grid>
          </FeatureGate>
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
        <EntityCatalogGraphCard variant="gridItem" height={400} />
      </Grid>
    </Grid>
  );
}

/**
 * Service entity page with feature-gated routes.
 * - Workflows tab: shows empty state when workflows feature is disabled
 * - Runtime Logs tab: shows empty state when observability feature is disabled
 * - Metrics tab: shows empty state when observability feature is disabled
 */
const serviceEntityPage = (
  <EntityLayout>
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

    <EntityLayout.Route path="/runtime-logs" title="Runtime Logs">
      <FeatureGatedContent feature="observability">
        <RuntimeLogs />
      </FeatureGatedContent>
    </EntityLayout.Route>

    <EntityLayout.Route path="/traits" title="Traits">
      <Traits />
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

    <EntityLayout.Route path="/docs" title="Docs">
      {techdocsContent}
    </EntityLayout.Route>
  </EntityLayout>
);

/**
 * Website entity page with feature-gated routes.
 * - Workflows tab: shows empty state when workflows feature is disabled
 * - Runtime Logs tab: shows empty state when observability feature is disabled
 * - Metrics tab: shows empty state when observability feature is disabled
 */
const websiteEntityPage = (
  <EntityLayout>
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

    <EntityLayout.Route path="/runtime-logs" title="Runtime Logs">
      <FeatureGatedContent feature="observability">
        <RuntimeLogs />
      </FeatureGatedContent>
    </EntityLayout.Route>

    <EntityLayout.Route path="/traits" title="Traits">
      <Traits />
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

    <EntityLayout.Route path="/docs" title="Docs">
      {techdocsContent}
    </EntityLayout.Route>
  </EntityLayout>
);

/**
 * NOTE: This page is designed to work on small screens such as mobile devices.
 * This is based on Material UI Grid. If breakpoints are used, each grid item must set the `xs` prop to a column size or to `true`,
 * since this does not default. If no breakpoints are used, the items will equitably share the available space.
 * https://material-ui.com/components/grid/#basic-grid.
 */

const defaultEntityPage = (
  <EntityLayout>
    <EntityLayout.Route path="/" title="Overview">
      <OverviewContent />
    </EntityLayout.Route>

    <EntityLayout.Route path="/docs" title="Docs">
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

const isWebsiteComponent = (entity: Entity) =>
  getComponentPageVariant(entity) === 'website';

const isScheduledTaskComponent = (entity: Entity) =>
  getComponentPageVariant(entity) === 'scheduled-task';

const componentPage = (
  <EntitySwitch>
    <EntitySwitch.Case if={isServiceComponent}>
      {serviceEntityPage}
    </EntitySwitch.Case>

    <EntitySwitch.Case if={isWebsiteComponent}>
      {websiteEntityPage}
    </EntitySwitch.Case>

    <EntitySwitch.Case if={isScheduledTaskComponent}>
      {defaultEntityPage}
    </EntitySwitch.Case>

    {/* Fallback for unknown component types or 'default' variant */}
    <EntitySwitch.Case>{defaultEntityPage}</EntitySwitch.Case>
  </EntitySwitch>
);

const apiPage = (
  <EntityLayout>
    <EntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3}>
        {entityWarningContent}
        <Grid item md={6}>
          <EntityAboutCard />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard variant="gridItem" height={400} />
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
  <EntityLayout>
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
  <EntityLayout>
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
 * System page with feature-gated Traces route.
 * - Traces tab: shows empty state when observability feature is disabled
 */
const systemPage = (
  <EntityLayout>
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
          <EntityCatalogGraphCard variant="gridItem" height={400} />
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
      />
    </EntityLayout.Route>
    <EntityLayout.Route path="/traces" title="Traces">
      <FeatureGatedContent feature="observability">
        <ObservabilityTraces />
      </FeatureGatedContent>
    </EntityLayout.Route>
  </EntityLayout>
);

const domainPage = (
  <EntityLayout>
    <EntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3} alignItems="stretch">
        {entityWarningContent}
        <Grid item md={6}>
          <EntityAboutCard variant="gridItem" />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard variant="gridItem" height={400} />
        </Grid>
        <Grid item md={6}>
          <EntityHasSystemsCard variant="gridItem" />
        </Grid>
      </Grid>
    </EntityLayout.Route>
  </EntityLayout>
);

const resourcePage = (
  <EntityLayout>
    <EntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3} alignItems="stretch">
        {entityWarningContent}
        <Grid item md={6}>
          <EntityAboutCard variant="gridItem" />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard variant="gridItem" height={400} />
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
  <EntityLayout>
    <EntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3} alignItems="stretch">
        {entityWarningContent}
        <Grid item md={6}>
          <EntityAboutCard variant="gridItem" />
        </Grid>
        <Grid item md={6} xs={12}>
          <EntityCatalogGraphCard variant="gridItem" height={400} />
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

    <EntitySwitch.Case>{defaultEntityPage}</EntitySwitch.Case>
  </EntitySwitch>
);
