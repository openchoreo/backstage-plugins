import Grid from '@material-ui/core/Grid';
import type { EntityContentLayoutProps } from '@backstage/plugin-catalog-react/alpha';
import { FeatureGate } from '@openchoreo/backstage-plugin-react';
import {
  WorkflowsOverviewCard,
  DeploymentStatusCard,
  RuntimeHealthCard,
} from '../../plugin';
import { EntityWarningStrip } from './EntityWarningStrip';
import { OpenChoreoAboutCard } from '../../components/OpenChoreoAboutCard';
import { ContainedCatalogGraphCard } from '../../components/ContainedCatalogGraphCard';
import { ForeignCardsSection } from './foreignCards';

/**
 * The Component-kind Overview layout. The portal separately overlays
 * `FailedBuildSnackbar` (private `openchoreo-portal-assistant` plugin,
 * not shipped to adopters) and `WorkflowsOrExternalCICard` (portal-only
 * adapter over Jenkins/GitHub Actions/GitLab) at the app layer; adopters
 * get the plain `WorkflowsOverviewCard` here. Both are opt-in
 * customizations rather than portal defaults, applied via the portal's
 * thin `page:catalog/entity` override.
 */
export default function ComponentOverviewLayout({
  cards,
}: EntityContentLayoutProps) {
  return (
    <Grid container spacing={3} alignItems="stretch">
      <EntityWarningStrip />
      <Grid item md={4} xs={12}>
        <WorkflowsOverviewCard />
      </Grid>
      <Grid item md={4} xs={12}>
        <DeploymentStatusCard />
      </Grid>
      <FeatureGate feature="observability">
        <Grid item md={4} xs={12}>
          <RuntimeHealthCard />
        </Grid>
      </FeatureGate>
      <Grid item md={6} xs={12}>
        <OpenChoreoAboutCard variant="gridItem" showEditIcon />
      </Grid>
      <Grid item md={6} xs={12}>
        <ContainedCatalogGraphCard height={400} />
      </Grid>
      <ForeignCardsSection cards={cards} />
    </Grid>
  );
}
