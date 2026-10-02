import Grid from '@material-ui/core/Grid';
import type { EntityContentLayoutProps } from '@backstage/plugin-catalog-react/alpha';
import {
  HookOverviewCard,
  HookBindingsCard,
} from '../../components/HookOverview';
import { EntityWarningStrip } from './EntityWarningStrip';
import { OpenChoreoAboutCard } from '../../components/OpenChoreoAboutCard';
import { ContainedCatalogGraphCard } from '../../components/ContainedCatalogGraphCard';
import { ForeignCardsSection } from './foreignCards';

/**
 * Overview layout shared by Hook and ClusterHook (deployment hooks, alpha).
 *
 * Deliberately not `TypeFamilyOverviewLayout`: a hook carries a second
 * full-width card — the pipelines that bind it — which the shared 3-card
 * type-family grid has no slot for. Relations are left unfiltered so the
 * graph shows both `bindsHook`/`hookBoundBy` (pipelines) and
 * `usesWorkflow`/`workflowUsedBy` (the workflow the hook runs).
 */
export default function HookOverviewLayout({
  cards,
}: EntityContentLayoutProps) {
  return (
    <Grid container spacing={3} alignItems="stretch">
      <EntityWarningStrip />
      <Grid item md={6} xs={12}>
        <HookOverviewCard />
      </Grid>
      <Grid item md={6} xs={12}>
        <ContainedCatalogGraphCard height={400} />
      </Grid>
      <Grid item md={12} xs={12}>
        <HookBindingsCard />
      </Grid>
      <Grid item md={12} xs={12}>
        <OpenChoreoAboutCard variant="gridItem" showEditIcon />
      </Grid>
      <ForeignCardsSection cards={cards} />
    </Grid>
  );
}
