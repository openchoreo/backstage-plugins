import Grid from '@material-ui/core/Grid';
import type { EntityContentLayoutProps } from '@backstage/plugin-catalog-react/alpha';
import {
  RELATION_HOSTED_ON,
  RELATION_HOSTS,
  RELATION_OBSERVED_BY,
  RELATION_OBSERVES,
} from '@openchoreo/backstage-plugin-common';
import {
  ClusterDataplaneStatusCard,
  ClusterDataplaneEnvironmentsCard,
  ClusterDataplaneGatewayConfigurationCard,
} from '../../components/ClusterDataplaneOverview';
import { EntityWarningStrip } from './EntityWarningStrip';
import { OpenChoreoAboutCard } from '../../components/OpenChoreoAboutCard';
import { ContainedCatalogGraphCard } from '../../components/ContainedCatalogGraphCard';
import { ForeignCardsSection } from './foreignCards';

export default function ClusterDataplaneOverviewLayout({
  cards,
}: EntityContentLayoutProps) {
  return (
    <Grid container spacing={3} alignItems="stretch">
      <EntityWarningStrip />
      <Grid item md={6} xs={12}>
        <ClusterDataplaneStatusCard />
      </Grid>
      <Grid item md={6} xs={12}>
        <ClusterDataplaneEnvironmentsCard />
      </Grid>
      <Grid item xs={12}>
        <ClusterDataplaneGatewayConfigurationCard />
      </Grid>
      <Grid item md={6} xs={12}>
        <OpenChoreoAboutCard variant="gridItem" showEditIcon />
      </Grid>
      <Grid item md={6} xs={12}>
        <ContainedCatalogGraphCard
          height={400}
          relations={[
            RELATION_HOSTED_ON,
            RELATION_HOSTS,
            RELATION_OBSERVED_BY,
            RELATION_OBSERVES,
          ]}
        />
      </Grid>
      <ForeignCardsSection cards={cards} />
    </Grid>
  );
}
