import { Content, Page, Header } from '@backstage/core-components';
import {
  HomePageStarredEntities,
  CustomHomepageGrid,
} from '@backstage/plugin-home';
import { HomePageSearchBar } from '@backstage/plugin-search';
import { SearchContextProvider } from '@backstage/plugin-search-react';
import { Grid, Typography, Box } from '@material-ui/core';
import { useStyles } from './styles';
import { useUserInfo } from '../../hooks';
import { useNamespacePermission } from '@openchoreo/backstage-plugin-react';
import { HomePagePlatformDetailsCard } from '@openchoreo/backstage-plugin-platform-engineer-core';
import {
  RecentlyVisitedHomeWidget,
  MyProjectsHomeWidget,
  QuickActionsHomeWidget,
  RecentDeploymentsHomeWidget,
} from './homeWidgets';

/**
 * Custom HomePage that shows content based on user permissions
 */
export const HomePage = () => {
  const classes = useStyles();
  const { userName, loading } = useUserInfo();
  const { canView: canViewPlatformDetails } = useNamespacePermission();

  if (loading) {
    return (
      <Page themeId="home">
        <Header title="Loading..." />
        <Content>
          <Typography>Loading user information...</Typography>
        </Content>
      </Page>
    );
  }

  return (
    <SearchContextProvider>
      <Page themeId="home">
        <Header title={`Welcome, ${userName}!`} />
        <Content>
          {/* Search Bar */}
          <Box mb={3}>
            <HomePageSearchBar
              InputProps={{
                classes: {
                  root: classes.searchBarInput,
                  notchedOutline: classes.searchBarOutline,
                },
              }}
              placeholder="Search"
            />
          </Box>

          {/* Customizable widget grid. */}
          <CustomHomepageGrid preventDuplicateWidgets>
            <HomePageStarredEntities />
            <RecentlyVisitedHomeWidget />
            <MyProjectsHomeWidget />
            <QuickActionsHomeWidget />
            <RecentDeploymentsHomeWidget />
          </CustomHomepageGrid>

          {/* Platform Details stays outside the grid on purpose. */}
          {canViewPlatformDetails && (
            <Grid container spacing={3} style={{ marginTop: 24 }}>
              <Grid item xs={12}>
                <Box className={classes.platformDetailsSection}>
                  <HomePagePlatformDetailsCard />
                </Box>
              </Grid>
            </Grid>
          )}
        </Content>
      </Page>
    </SearchContextProvider>
  );
};