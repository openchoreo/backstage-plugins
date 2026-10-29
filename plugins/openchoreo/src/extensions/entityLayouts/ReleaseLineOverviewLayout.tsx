import Grid from '@material-ui/core/Grid';
import type { EntityContentLayoutProps } from '@backstage/plugin-catalog-react/alpha';
import { EntityProvider, useEntity } from '@backstage/plugin-catalog-react';
import { Progress } from '@backstage/core-components';
import {
  FeatureGate,
  useReleaseLineComponentEntity,
} from '@openchoreo/backstage-plugin-react';
import {
  WorkflowsOverviewCard,
  DeploymentStatusCard,
  RuntimeHealthCard,
} from '../../plugin';
import { EntityWarningStrip } from './EntityWarningStrip';
import { OpenChoreoAboutCard } from '../../components/OpenChoreoAboutCard';
import { ContainedCatalogGraphCard } from '../../components/ContainedCatalogGraphCard';

/**
 * The ReleaseLine-kind Overview layout. The build, deploy and runtime summary
 * cards are the component's, rendered for the line's component and scoped to
 * the line by the page's `ReleaseLineProvider`.
 */
export default function ReleaseLineOverviewLayout(
  _props: EntityContentLayoutProps,
) {
  const { entity } = useEntity();
  const { componentEntity, loading } = useReleaseLineComponentEntity(entity);

  return (
    <Grid container spacing={3} alignItems="stretch">
      <EntityWarningStrip />
      {loading && (
        <Grid item xs={12}>
          <Progress />
        </Grid>
      )}
      {componentEntity && (
        <EntityProvider entity={componentEntity}>
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
        </EntityProvider>
      )}
      <Grid item md={6} xs={12}>
        <OpenChoreoAboutCard variant="gridItem" showEditIcon />
      </Grid>
      <Grid item md={6} xs={12}>
        <ContainedCatalogGraphCard height={400} />
      </Grid>
    </Grid>
  );
}
