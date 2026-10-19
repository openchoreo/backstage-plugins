import Grid from '@material-ui/core/Grid';
import type { EntityContentLayoutProps } from '@backstage/plugin-catalog-react/alpha';
import {
  EndpointRoutingCard,
  EndpointDeploymentsCard,
  EndpointApiCard,
} from '../../components/EndpointOverview';
import { EntityWarningStrip } from './EntityWarningStrip';
import { OpenChoreoAboutCard } from '../../components/OpenChoreoAboutCard';
import { ContainedCatalogGraphCard } from '../../components/ContainedCatalogGraphCard';
import { ForeignCardsSection } from './foreignCards';

export default function EndpointOverviewLayout({
  cards,
}: EntityContentLayoutProps) {
  return (
    <Grid container spacing={3} alignItems="stretch">
      <EntityWarningStrip />
      <Grid item md={6} xs={12}>
        <EndpointRoutingCard />
      </Grid>
      <Grid item md={3} xs={12}>
        <EndpointDeploymentsCard />
      </Grid>
      <Grid item md={3} xs={12}>
        <EndpointApiCard />
      </Grid>
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
