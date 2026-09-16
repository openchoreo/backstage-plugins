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

/**
 * Default widget arrangement — the pre-composable home page: Starred Entities
 * and Recently Visited side by side. Users can add the remaining widgets (My
 * Projects, Quick Actions, Recent Deployments) via the grid's "Add widget"
 * control; their choices persist per user via the StorageApi.
 *
 * `component` values are the widget names (`core.extensionName`) declared by the
 * corresponding home page widget extensions in `homeExtensions.tsx`.
 */
const defaultLayout: LayoutConfiguration[] = [
  { component: 'HomePageStarredEntities', x: 0, y: 0, width: 6, height: 4 },
  { component: 'OpenChoreoRecentlyVisited', x: 6, y: 0, width: 6, height: 4 },
];

/**
 * Custom layout for the composable home page. Renders the fixed page shell
 * (welcome header, search bar and the Platform Details section) around the
 * editable widget grid. Platform Details stays outside the grid on purpose so
 * it cannot be moved or removed.
 */
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

          {/* Editable widget grid — layout persists per user via StorageApi. */}
          <CustomHomepageGrid config={defaultLayout}>
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
