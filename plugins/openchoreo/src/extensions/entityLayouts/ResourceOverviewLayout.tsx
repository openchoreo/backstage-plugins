import Grid from '@material-ui/core/Grid';
import type { EntityContentLayoutProps } from '@backstage/plugin-catalog-react/alpha';
import {
  ResourceParametersCard,
  ResourceDeploymentsCard,
  ConsumingComponentsCard,
} from '../../components/ResourceOverview';
import { EntityWarningStrip } from './EntityWarningStrip';
import { OpenChoreoAboutCard } from '../../components/OpenChoreoAboutCard';
import { ContainedCatalogGraphCard } from '../../components/ContainedCatalogGraphCard';
import { ForeignCardsSection } from './foreignCards';

export default function ResourceOverviewLayout({
  cards,
}: EntityContentLayoutProps) {
  return (
    <Grid container spacing={3} alignItems="stretch">
      <EntityWarningStrip />
      <Grid item md={4} xs={12}>
        <ResourceParametersCard />
      </Grid>
      <Grid item md={4} xs={12}>
        <ResourceDeploymentsCard />
      </Grid>
      <Grid item md={4} xs={12}>
        <ConsumingComponentsCard />
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
