import Grid from '@material-ui/core/Grid';
import type { EntityContentLayoutProps } from '@backstage/plugin-catalog-react/alpha';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  BuildFailureNotifierSlot,
  FeatureGate,
} from '@openchoreo/backstage-plugin-react';
import {
  WorkflowsOverviewCard,
  DeploymentStatusCard,
  RuntimeHealthCard,
} from '../../plugin';
import { EntityWarningStrip } from './EntityWarningStrip';
import { OpenChoreoAboutCard } from '../../components/OpenChoreoAboutCard';
import { ContainedCatalogGraphCard } from '../../components/ContainedCatalogGraphCard';
import { ForeignCardsSection } from './foreignCards';
import {
  ReleaseLinesCard,
  useHasReleaseLines,
} from '../../components/ReleaseLines';

/**
 * The Component-kind Overview layout. A component with release lines lists
 * its lines first, and its summary cards work on the default line, as its tabs do.
 * `BuildFailureNotifierSlot` renders the host app's assistant prompt for a
 * failed build run (nothing when no assistant integration is registered — the
 * stock portal's is private and not shipped to adopters).
 */
export default function ComponentOverviewLayout({
  cards,
}: EntityContentLayoutProps) {
  const { entity } = useEntity();
  const { hasLines } = useHasReleaseLines(entity);

  return (
    <Grid container spacing={3} alignItems="stretch">
      <BuildFailureNotifierSlot />
      <EntityWarningStrip />
      {hasLines && (
        <Grid item xs={12}>
          <ReleaseLinesCard />
        </Grid>
      )}
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
