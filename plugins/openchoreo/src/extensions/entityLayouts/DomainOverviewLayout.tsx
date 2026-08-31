import Grid from '@material-ui/core/Grid';
import type { EntityContentLayoutProps } from '@backstage/plugin-catalog-react/alpha';
import {
  NamespaceProjectsCard,
  NamespaceResourcesCard,
} from '../../components/Namespaces';
import { EntityWarningStrip } from './EntityWarningStrip';
import { OpenChoreoAboutCard } from '../../components/OpenChoreoAboutCard';
import { ContainedCatalogGraphCard } from '../../components/ContainedCatalogGraphCard';
import { ForeignCardsSection } from './foreignCards';

export default function DomainOverviewLayout({
  cards,
}: EntityContentLayoutProps) {
  return (
    <Grid container spacing={3} alignItems="stretch">
      <EntityWarningStrip />
      <Grid item md={6} xs={12}>
        <NamespaceProjectsCard />
      </Grid>
      <Grid item md={6} xs={12}>
        <NamespaceResourcesCard />
      </Grid>
      <Grid item md={6} xs={12}>
        <OpenChoreoAboutCard variant="gridItem" showEditIcon />
      </Grid>
      <Grid item md={6} xs={12}>
        <ContainedCatalogGraphCard height={500} zoom="enabled" maxDepth={1} />
      </Grid>
      <ForeignCardsSection cards={cards} />
    </Grid>
  );
}
