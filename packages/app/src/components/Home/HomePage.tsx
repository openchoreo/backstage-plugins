import { Content, Page, Header } from '@backstage/core-components';
import {
  HomePageRecentlyVisited,
  HomePageStarredEntities,
} from '@backstage/plugin-home';
import { HomePageSearchBar } from '@backstage/plugin-search';
import { SearchContextProvider } from '@backstage/plugin-search-react';
import { Grid, Typography, Box } from '@material-ui/core';
import { useStyles } from './styles';
import { useUserGroups } from '../../hooks';
import { useNamespacePermission } from '@openchoreo/backstage-plugin-react';
import { HomePagePlatformDetailsCard } from '@openchoreo/backstage-plugin-platform-engineer-core';

/**
 * Custom HomePage that shows content based on user permissions
 */
export const HomePage = () => {
  const classes = useStyles();
  const { userName, loading } = useUserGroups();
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
          <Grid container spacing={3}>
            {/* Search Bar */}
            <Grid item xs={12}>
              <HomePageSearchBar
                InputProps={{
                  classes: {
                    root: classes.searchBarInput,
                    notchedOutline: classes.searchBarOutline,
                  },
                }}
                placeholder="Search"
              />
            </Grid>

            {/* Starred Entities and Recently Visited */}
            <Grid item xs={12}>
              <Grid container spacing={3} alignItems="stretch">
                <Grid item xs={12} md={6} style={{ display: 'flex' }}>
                  <Box className={classes.starredEntitiesWrapper}>
                    <HomePageStarredEntities />
                  </Box>
                </Grid>
                <Grid item xs={12} md={6} style={{ display: 'flex' }}>
                  <Box className={classes.starredEntitiesWrapper}>
                    <HomePageRecentlyVisited />
                  </Box>
                </Grid>
              </Grid>
            </Grid>

            {/* Platform Details - visible only with namespace read permission */}
            {canViewPlatformDetails && (
              <Grid item xs={12}>
                <Box className={classes.platformDetailsSection}>
                  <HomePagePlatformDetailsCard />
                </Box>
              </Grid>
            )}
          </Grid>
        </Content>
      </Page>
    </SearchContextProvider>
  );
};
