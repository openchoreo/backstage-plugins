import { Content, Page, Header } from '@backstage/core-components';
import {
  HomePageRecentlyVisited,
  HomePageStarredEntities,
  HomePageToolkit,
} from '@backstage/plugin-home';
import { HomePageSearchBar } from '@backstage/plugin-search';
import { SearchContextProvider } from '@backstage/plugin-search-react';
import { Grid, Typography, Box } from '@material-ui/core';
import { useStyles } from './styles';
import { useUserGroups } from '../../hooks';
import { HomePagePlatformDetailsCard } from '@openchoreo/backstage-plugin-platform-engineer-core';
import { MyProjectsWidget } from '@openchoreo/backstage-plugin';
import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline';
import ViewListIcon from '@material-ui/icons/ViewList';
import AppsIcon from '@material-ui/icons/Apps';
import FeaturedPlayListOutlinedIcon from '@material-ui/icons/FeaturedPlayListOutlined';
import CreateNewFolderIcon from '@material-ui/icons/CreateNewFolder';

/**
 * Toolkit tools for the home page
 */
const toolkitTools = [
  {
    url: '/create/templates/default/create-openchoreo-component',
    label: 'Create Component',
    icon: <AddCircleOutlineIcon color="primary" />,
  },
  {
    url: '/create/templates/default/create-openchoreo-project',
    label: 'Create Project',
    icon: <CreateNewFolderIcon color="primary" />,
  },
  {
    url: '/catalog?filters[kind]=System&filters[user]=owned',
    label: 'View My Projects',
    icon: <ViewListIcon color="primary" />,
  },
  {
    url: '/catalog?filters[kind]=Component&filters[user]=owned',
    label: 'View My Components',
    icon: <AppsIcon color="primary" />,
  },
  {
    url: '/create',
    label: 'Browse Templates',
    icon: <FeaturedPlayListOutlinedIcon color="primary" />,
  },
];

/**
 * Custom HomePage that shows different content based on user groups
 */
export const HomePage = () => {
  const classes = useStyles();
  const { userGroups, userName, loading } = useUserGroups();

  // Determine user role based on groups
  const getUserRole = () => {
    if (userGroups.includes('platformengineer')) return 'platformengineer';
    if (userGroups.includes('developer')) return 'developer';
    return 'user';
  };

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
        <Header title={`Welcome, ${userName}!`} subtitle={getUserRole()} />
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

            {/* Platform Engineer: Starred and Recently Visited + Platform Details */}
            {getUserRole() === 'platformengineer' && (
              <>
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
                <Grid item xs={12}>
                  <Box className={classes.platformDetailsSection}>
                    <HomePagePlatformDetailsCard />
                  </Box>
                </Grid>
              </>
            )}

            {/* Recent Activity - Only for non-PE users (PEs have it above) */}
            {getUserRole() !== 'platformengineer' && (
              <Grid item xs={12}>
                <Box className={classes.platformDetailsSection}>
                  <HomePagePlatformDetailsCard />
                </Box>
              </Grid>
            )}

            {/* Recent Activity - Full-width, horizontal layout */}
            <Grid item xs={12}>
              <Typography
                variant="h4"
                color="secondary"
                style={{ marginBottom: 16 }}
              >
                Recent Activity
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <HomePageStarredEntities />
                </Grid>
                <Grid item xs={12} md={6}>
                  <HomePageRecentlyVisited />
                </Grid>
              </Grid>
            </Grid>

            {/* Main content column */}
            <Grid item xs={12} md={8}>
              {/* Developer Overview Section */}
              {getUserRole() === 'developer' && (
                <Box className={classes.overviewSection}>
                  <Typography variant="h3">Overview</Typography>
                  <Grid container className={classes.widgetContainer}>
                    <Grid item xs={12} md={5} sm={12}>
                      <MyProjectsWidget />
                    </Grid>
                  </Grid>
                </Box>
              )}
              {/* Toolkit - conditional based on role */}
              {(userGroups.includes('admin') ||
                userGroups.includes('manager') ||
                userGroups.includes('developer')) && (
                <HomePageToolkit title="Quick Actions" tools={toolkitTools} />
              )}
            </Grid>
          </Grid>
        </Content>
      </Page>
    </SearchContextProvider>
  );
};
