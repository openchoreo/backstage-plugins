import Grid from '@material-ui/core/Grid';
import type { EntityContentLayoutProps } from '@backstage/plugin-catalog-react/alpha';
import { RELATION_PART_OF, RELATION_HAS_PART } from '@backstage/catalog-model';
import {
  RELATION_DEPLOYS_TO,
  RELATION_DEPLOYED_BY,
  RELATION_HOSTED_ON,
  RELATION_HOSTS,
} from '@openchoreo/backstage-plugin-common';
import {
  EnvironmentStatusSummaryCard,
  EnvironmentPromotionCard,
  EnvironmentDeployedComponentsCard,
  EnvironmentGatewayConfigurationCard,
  EnvironmentHooksCard,
} from '../../components/EnvironmentOverview';
import { useHooksEnabled } from '@openchoreo/backstage-plugin-react';
import { EntityWarningStrip } from './EntityWarningStrip';
import { OpenChoreoAboutCard } from '../../components/OpenChoreoAboutCard';
import { ContainedCatalogGraphCard } from '../../components/ContainedCatalogGraphCard';
import { ForeignCardsSection } from './foreignCards';

export default function EnvironmentOverviewLayout({
  cards,
}: EntityContentLayoutProps) {
  const hooksEnabled = useHooksEnabled();
  return (
    <Grid container spacing={3} alignItems="stretch">
      <EntityWarningStrip />
      <Grid item md={6} xs={12}>
        <EnvironmentStatusSummaryCard />
      </Grid>
      <Grid item md={6} xs={12}>
        <EnvironmentPromotionCard />
      </Grid>
      {hooksEnabled && (
        <Grid item xs={12}>
          <EnvironmentHooksCard />
        </Grid>
      )}
      <Grid item xs={12}>
        <EnvironmentDeployedComponentsCard />
      </Grid>
      <Grid item xs={12}>
        <EnvironmentGatewayConfigurationCard />
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
            RELATION_DEPLOYS_TO,
            RELATION_DEPLOYED_BY,
            RELATION_HOSTED_ON,
            RELATION_HOSTS,
          ]}
        />
      </Grid>
      <ForeignCardsSection cards={cards} />
    </Grid>
  );
}
