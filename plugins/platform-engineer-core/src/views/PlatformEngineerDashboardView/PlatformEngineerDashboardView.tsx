import { Content, Page, Header } from '@backstage/core-components';
import { Typography, Grid } from '@material-ui/core';
import {
  InfrastructureWidget,
  DeveloperPortalWidget,
  HomePagePlatformDetailsCard,
} from '../../components';
import { useStyles } from './styles';

export const PlatformEngineerDashboardView = () => {
  const classes = useStyles();

  return (
    <Page themeId="tool">
      <Header title="Platform Engineer Dashboard" />
      <Content className={classes.pageContent}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={12}>
            <Typography variant="h3">Platform Overview</Typography>
          </Grid>
          <Grid item xs={12} md={4} sm={6}>
            <InfrastructureWidget />
          </Grid>
          <Grid item xs={12} md={4} sm={6}>
            <DeveloperPortalWidget />
          </Grid>
          <Grid item xs={12} md={12}>
            <HomePagePlatformDetailsCard />
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};
