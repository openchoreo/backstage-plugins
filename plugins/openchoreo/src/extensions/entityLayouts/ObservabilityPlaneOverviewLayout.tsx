import Grid from '@material-ui/core/Grid';
import type { EntityContentLayoutProps } from '@backstage/plugin-catalog-react/alpha';
import { RELATION_PART_OF, RELATION_HAS_PART } from '@backstage/catalog-model';
import {
  RELATION_OBSERVED_BY,
  RELATION_OBSERVES,
} from '@openchoreo/backstage-plugin-common';
import {
  ObservabilityPlaneStatusCard,
  ObservabilityPlaneLinkedPlanesCard,
} from '../../components/ObservabilityPlaneOverview';
import { EntityWarningStrip } from './EntityWarningStrip';
import { OpenChoreoAboutCard } from '../../components/OpenChoreoAboutCard';
import { ContainedCatalogGraphCard } from '../../components/ContainedCatalogGraphCard';
import { ForeignCardsSection } from './foreignCards';

export default function ObservabilityPlaneOverviewLayout({
  cards,
}: EntityContentLayoutProps) {
  return (
    <Grid container spacing={3} alignItems="stretch">
      <EntityWarningStrip />
      <Grid item md={6} xs={12}>
        <ObservabilityPlaneStatusCard />
      </Grid>
      <Grid item md={6} xs={12}>
        <ObservabilityPlaneLinkedPlanesCard />
      </Grid>
      <Grid item md={6} xs={12}>
        <OpenChoreoAboutCard variant="gridItem" showEditIcon />
      </Grid>
      <Grid item md={6} xs={12}>
        <ContainedCatalogGraphCard
          height={400}
          relations={[
            RELATION_PART_OF,
            RELATION_HAS_PART,
            RELATION_OBSERVED_BY,
            RELATION_OBSERVES,
          ]}
          unidirectional={false}
        />
      </Grid>
      <ForeignCardsSection cards={cards} />
    </Grid>
  );
}
