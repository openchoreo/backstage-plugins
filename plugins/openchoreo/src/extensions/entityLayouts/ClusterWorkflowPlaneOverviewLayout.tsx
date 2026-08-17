import Grid from '@material-ui/core/Grid';
import type { EntityContentLayoutProps } from '@backstage/plugin-catalog-react/alpha';
import {
  RELATION_OBSERVED_BY,
  RELATION_OBSERVES,
  RELATION_BUILDS_ON,
  RELATION_BUILDS,
} from '@openchoreo/backstage-plugin-common';
import { ClusterWorkflowPlaneStatusCard } from '../../components/ClusterWorkflowPlaneOverview';
import { EntityWarningStrip } from './EntityWarningStrip';
import { OpenChoreoAboutCard } from '../../components/OpenChoreoAboutCard';
import { ContainedCatalogGraphCard } from '../../components/ContainedCatalogGraphCard';
import { ForeignCardsSection } from './foreignCards';

export default function ClusterWorkflowPlaneOverviewLayout({
  cards,
}: EntityContentLayoutProps) {
  return (
    <Grid container spacing={3} alignItems="stretch">
      <EntityWarningStrip />
      <Grid item md={6} xs={12}>
        <ClusterWorkflowPlaneStatusCard />
      </Grid>
      <Grid item md={6} xs={12}>
        <ContainedCatalogGraphCard
          height={400}
          relations={[
            RELATION_OBSERVED_BY,
            RELATION_OBSERVES,
            RELATION_BUILDS_ON,
            RELATION_BUILDS,
          ]}
        />
      </Grid>
      <Grid item md={12} xs={12}>
        <OpenChoreoAboutCard variant="gridItem" showEditIcon />
      </Grid>
      <ForeignCardsSection cards={cards} />
    </Grid>
  );
}
