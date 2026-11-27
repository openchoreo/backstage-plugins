import { Fragment, useMemo } from 'react';
import { Content, Page, Header } from '@backstage/core-components';
import { configApiRef, useApi } from '@backstage/core-plugin-api';
import { CustomHomepageGrid } from '@backstage/plugin-home';
import type { HomePageLayoutProps } from '@backstage/plugin-home-react/alpha';
import { HomePageSearchBar } from '@backstage/plugin-search';
import { SearchContextProvider } from '@backstage/plugin-search-react';
import { Grid, Typography, Box } from '@material-ui/core';
import { useStyles } from './styles';
import { useUserInfo } from '../../hooks';
import { useNamespacePermission } from '@openchoreo/backstage-plugin-react';
import { HomePagePlatformDetailsCard } from '@openchoreo/backstage-plugin-platform-engineer-core';
import { readHomeLayout, toLayoutConfiguration } from './defaultLayout';

// Per-breakpoint columns. The default `md: 10` can't fit two width-6 cards, so
// on ~1200px (14") screens the second card overlaps. `md: 12` keeps them side
// by side; smaller breakpoints stay <= 6 cols so cards stack full-width.
const gridCols = { xxs: 2, xs: 4, sm: 6, md: 12, lg: 12, xl: 12 };

// Home page shell (welcome header, search, Platform Details) around the
// editable widget grid.
export const HomePageLayout = ({ widgets }: HomePageLayoutProps) => {
  const classes = useStyles();
  const configApi = useApi(configApiRef);
  const gridConfig = useMemo(
    () => toLayoutConfiguration(readHomeLayout(configApi), widgets),
    [configApi, widgets],
  );
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

          <CustomHomepageGrid
            config={gridConfig}
            cols={gridCols}
            containerPadding={[0, 10]}
          >
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
