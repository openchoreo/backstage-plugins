import { Fragment } from 'react';
import { Content, Page, Header } from '@backstage/core-components';
import {
  CustomHomepageGrid,
  type LayoutConfiguration,
} from '@backstage/plugin-home';
import type { HomePageLayoutProps } from '@backstage/plugin-home-react/alpha';
import { HomePageSearchBar } from '@backstage/plugin-search';
import { SearchContextProvider } from '@backstage/plugin-search-react';
import { Grid, Typography, Box } from '@material-ui/core';
import { useStyles } from './styles';
import { useUserInfo } from '../../hooks';
import { useNamespacePermission } from '@openchoreo/backstage-plugin-react';
import { HomePagePlatformDetailsCard } from '@openchoreo/backstage-plugin-platform-engineer-core';

// Default layout: Starred Entities + Recently Visited side by side. Other
// widgets are added via the grid's "Add widget" control. `component` is each
// widget's core.extensionName (declared in homeExtensions.tsx).
const defaultLayout: LayoutConfiguration[] = [
  { component: 'HomePageStarredEntities', x: 0, y: 0, width: 6, height: 4 },
  { component: 'OpenChoreoRecentlyVisited', x: 6, y: 0, width: 6, height: 4 },
];

// Home page shell (welcome header, search, Platform Details) around the
// editable widget grid.
export const HomePageLayout = ({ widgets }: HomePageLayoutProps) => {
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

          <CustomHomepageGrid config={defaultLayout} containerPadding={[0, 10]}>
            {widgets.map((widget, index) => (
              <Fragment key={widget.name ?? index}>{widget.component}</Fragment>
            ))}
          </CustomHomepageGrid>

          {/* Platform Details stays outside the grid: fixed and uneditable. */}
          {canViewPlatformDetails && (
            <Grid container spacing={3} className={classes.platformDetailsGrid}>
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
