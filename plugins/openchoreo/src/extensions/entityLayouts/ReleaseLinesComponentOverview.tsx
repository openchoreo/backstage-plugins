import Grid from '@material-ui/core/Grid';
import { OpenChoreoAboutCard } from '../../components/OpenChoreoAboutCard';
import { ContainedCatalogGraphCard } from '../../components/ContainedCatalogGraphCard';
import { ReleaseLinesCard } from '../../components/ReleaseLines';
import { EntityWarningStrip } from './EntityWarningStrip';

/**
 * Overview of a component with release lines: its release lines, which carry
 * the build, deploy and runtime views, plus About and Relations.
 */
export function ReleaseLinesComponentOverview() {
  return (
    <Grid container spacing={3} alignItems="stretch">
      <EntityWarningStrip />
      <Grid item xs={12}>
        <ReleaseLinesCard />
      </Grid>
      <Grid item md={6} xs={12}>
        <OpenChoreoAboutCard variant="gridItem" showEditIcon />
      </Grid>
      <Grid item md={6} xs={12}>
        <ContainedCatalogGraphCard height={400} />
      </Grid>
    </Grid>
  );
}
