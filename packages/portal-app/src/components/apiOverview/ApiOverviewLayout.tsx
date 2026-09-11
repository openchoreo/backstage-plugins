import Grid from '@material-ui/core/Grid';
import { makeStyles } from '@material-ui/core/styles';
import type { EntityContentLayoutProps } from '@backstage/plugin-catalog-react/alpha';
import {
  ProvidingComponentsCard,
  ConsumingComponentsCard,
} from '@backstage/plugin-api-docs';
import {
  ContainedCatalogGraphCard,
  EntityWarningStrip,
  ForeignCardsSection,
  OpenChoreoAboutCard,
} from '@openchoreo/backstage-plugin';

// Normalize title size across BUI cards (h3.bui-Text) and MUI cards
// (MuiCardHeader-title-* — hashed in this app, matched via [class*=...]).
const useStyles = makeStyles(theme => ({
  root: {
    '& [class*="MuiCardHeader-title"], & h3.bui-Text': {
      fontSize: '1rem',
      fontWeight: 600,
      lineHeight: 1.6,
      color: theme.palette.text.primary,
    },
  },
}));

export default function ApiOverviewLayout({ cards }: EntityContentLayoutProps) {
  const classes = useStyles();
  return (
    <Grid container spacing={3} alignItems="stretch" className={classes.root}>
      <EntityWarningStrip />
      <Grid item md={6} xs={12}>
        <ProvidingComponentsCard />
      </Grid>
      <Grid item md={6} xs={12}>
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
