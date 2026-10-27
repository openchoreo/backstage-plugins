import Grid from '@material-ui/core/Grid';
import type { EntityContentLayoutProps } from '@backstage/plugin-catalog-react/alpha';
import {
  RELATION_NOTIFIES,
  RELATION_NOTIFIED_BY,
} from '@openchoreo/backstage-plugin-common';
import { NotificationChannelConfigCard } from '../../components/NotificationChannelOverview';
import { EntityWarningStrip } from './EntityWarningStrip';
import { OpenChoreoAboutCard } from '../../components/OpenChoreoAboutCard';
import { ContainedCatalogGraphCard } from '../../components/ContainedCatalogGraphCard';
import { ForeignCardsSection } from './foreignCards';

export default function NotificationChannelOverviewLayout({
  cards,
}: EntityContentLayoutProps) {
  return (
    <Grid container spacing={3} alignItems="stretch">
      <EntityWarningStrip />
      <Grid item xs={12}>
        <NotificationChannelConfigCard />
      </Grid>
      <Grid item md={6} xs={12}>
        <OpenChoreoAboutCard variant="gridItem" showEditIcon />
      </Grid>
      <Grid item md={6} xs={12}>
        <ContainedCatalogGraphCard
          height={400}
          relations={[RELATION_NOTIFIES, RELATION_NOTIFIED_BY]}
          unidirectional={false}
        />
      </Grid>
      <ForeignCardsSection cards={cards} />
    </Grid>
  );
}
