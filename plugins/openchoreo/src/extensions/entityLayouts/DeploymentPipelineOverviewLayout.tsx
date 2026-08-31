import Grid from '@material-ui/core/Grid';
import type { EntityContentLayoutProps } from '@backstage/plugin-catalog-react/alpha';
import { RELATION_PART_OF, RELATION_HAS_PART } from '@backstage/catalog-model';
import {
  RELATION_DEPLOYS_TO,
  RELATION_DEPLOYED_BY,
  RELATION_USES_PIPELINE,
  RELATION_PIPELINE_USED_BY,
} from '@openchoreo/backstage-plugin-common';
import {
  DeploymentPipelineVisualization,
  PromotionPathsCard,
} from '../../components/DeploymentPipelineOverview';
import { EntityWarningStrip } from './EntityWarningStrip';
import { OpenChoreoAboutCard } from '../../components/OpenChoreoAboutCard';
import { ContainedCatalogGraphCard } from '../../components/ContainedCatalogGraphCard';
import { ForeignCardsSection } from './foreignCards';

export default function DeploymentPipelineOverviewLayout({
  cards,
}: EntityContentLayoutProps) {
  return (
    <Grid container spacing={3} alignItems="stretch">
      <EntityWarningStrip />
      <Grid item md={6} xs={12}>
        <DeploymentPipelineVisualization />
      </Grid>
      <Grid item md={6} xs={12}>
        <PromotionPathsCard />
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
            RELATION_USES_PIPELINE,
            RELATION_PIPELINE_USED_BY,
          ]}
        />
      </Grid>
      <ForeignCardsSection cards={cards} />
    </Grid>
  );
}
