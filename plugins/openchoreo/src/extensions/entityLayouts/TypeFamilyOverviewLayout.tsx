import { type ComponentProps, type ComponentType } from 'react';
import Grid from '@material-ui/core/Grid';
import type { EntityContentLayoutProps } from '@backstage/plugin-catalog-react/alpha';
import { EntityWarningStrip } from './EntityWarningStrip';
import { OpenChoreoAboutCard } from '../../components/OpenChoreoAboutCard';
import { ContainedCatalogGraphCard } from '../../components/ContainedCatalogGraphCard';
import { ForeignCardsSection } from './foreignCards';

type GraphCardProps = ComponentProps<typeof ContainedCatalogGraphCard>;

/**
 * The uniform 3-card Overview layout shared by every "type-family" OC kind
 * — ComponentType, ResourceType, ProjectType, TraitType, Workflow,
 * ComponentWorkflow, and their Cluster variants. Each kind's blueprint
 * loader supplies its own head card via `OverviewCard`; everything else is
 * the same grid.
 *
 * `graphProps` is passed through to `ContainedCatalogGraphCard` for kinds
 * (like ComponentWorkflow) that need a narrower relation set than the
 * default. `height` is fixed to 400 to match today's `EntityPage.tsx`.
 */
export interface TypeFamilyOverviewLayoutProps {
  OverviewCard: ComponentType;
  graphProps?: Omit<GraphCardProps, 'height'>;
  /**
   * Cards from `EntityContentLayoutProps.cards` passed through by the
   * wrapping layout module. Non-OC entries are appended at the tail via
   * `ForeignCardsSection`.
   */
  cards?: EntityContentLayoutProps['cards'];
}

export function TypeFamilyOverviewLayout({
  OverviewCard,
  graphProps,
  cards,
}: TypeFamilyOverviewLayoutProps) {
  return (
    <Grid container spacing={3} alignItems="stretch">
      <EntityWarningStrip />
      <Grid item md={6} xs={12}>
        <OverviewCard />
      </Grid>
      <Grid item md={6} xs={12}>
        <ContainedCatalogGraphCard height={400} {...graphProps} />
      </Grid>
      <Grid item md={12} xs={12}>
        <OpenChoreoAboutCard variant="gridItem" showEditIcon />
      </Grid>
      {cards && <ForeignCardsSection cards={cards} />}
    </Grid>
  );
}
