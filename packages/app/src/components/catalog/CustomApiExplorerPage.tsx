import { useState } from 'react';
import { Box, Button, Drawer, Grid } from '@material-ui/core';
import FilterListIcon from '@material-ui/icons/FilterList';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { useRouteRef } from '@backstage/core-plugin-api';
import { catalogImportPlugin } from '@backstage/plugin-catalog-import';
import { Link } from 'react-router-dom';
import { PageWithHeader, Content } from '@backstage/core-components';
import {
  EntityKindPicker,
  EntityListProvider,
  EntityLifecyclePicker,
  EntityNamespacePicker,
  EntityProcessingStatusPicker,
  EntityTagPicker,
} from '@backstage/plugin-catalog-react';
import { StarredFilter } from './CustomPersonalFilters';
import { CatalogCardList } from './CatalogCardList';
import { useStyles } from './styles';

export const CustomApiExplorerPage = () => {
  const classes = useStyles();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const registerApiLink = useRouteRef(catalogImportPlugin.routes.importPage);

  return (
    <PageWithHeader title="APIs" themeId="home">
      <Content>
        <EntityListProvider pagination={{ mode: 'offset', limit: 25 }}>
          <EntityKindPicker initialFilter="api" hidden />
          <Box className={classes.root}>
            {/* Header with Filter button (mobile only) */}
            <Box className={classes.header}>
              <Box
                className={classes.filterButton}
                component="button"
                onClick={() => setDrawerOpen(true)}
                style={{
                  gap: '8px',
                }}
              >
                <FilterListIcon fontSize="small" />
                <span className={classes.filterButtonText}>Filters</span>
              </Box>
            </Box>

            {/* Filters at the top (desktop) */}
            <Box className={classes.filterSection}>
              <Grid container spacing={2} alignItems="center">
                <Grid item sm={12} md={4} lg={3}>
                  <EntityNamespacePicker />
                </Grid>
                <Grid item className={classes.advancedFiltersGridItem}>
                  <button
                    className={classes.advancedFiltersToggle}
                    onClick={() => setAdvancedFiltersOpen(!advancedFiltersOpen)}
                  >
                    Advanced Filters
                    <ExpandMoreIcon
                      fontSize="small"
                      className={`${classes.advancedFiltersIcon} ${
                        advancedFiltersOpen
                          ? classes.advancedFiltersExpanded
                          : ''
                      }`}
                    />
                  </button>
                </Grid>
              </Grid>

              {/* Advanced Filters Grid - Shown when expanded */}
              {advancedFiltersOpen && (
                <Grid container spacing={2}>
                  <Grid item sm={12} md={4} lg={3}>
                    <EntityTagPicker />
                  </Grid>
                  <Grid
                    item
                    sm={12}
                    md={4}
                    lg={3}
                    className={classes.hideWhenEmpty}
                  >
                    <EntityLifecyclePicker />
                  </Grid>
                  <Grid item sm={12} md={4} lg={3}>
                    <EntityProcessingStatusPicker />
                  </Grid>
                </Grid>
              )}
            </Box>

            {/* Filter drawer for mobile */}
            <Drawer
              anchor="left"
              open={drawerOpen}
              onClose={() => setDrawerOpen(false)}
              className={classes.filterDrawer}
            >
              <Box className={classes.filterDrawerContent}>
                <Box className={classes.filterGrid}>
                  <Box className={classes.filterItem}>
                    <EntityNamespacePicker />
                  </Box>
                  <Box className={classes.filterItem}>
                    <StarredFilter />
                  </Box>
                  <Box className={classes.filterItem}>
                    <EntityLifecyclePicker />
                  </Box>
                  <Box className={classes.filterItem}>
                    <EntityTagPicker />
                  </Box>
                  <Box className={classes.filterItem}>
                    <EntityProcessingStatusPicker />
                  </Box>
                </Box>
              </Box>
            </Drawer>

            {/* API card list */}
            <Box className={classes.contentArea}>
              <CatalogCardList
                actionButton={
                  <Button
                    variant="contained"
                    color="primary"
                    component={Link}
                    to={registerApiLink()}
                    size="small"
                  >
                    Register
                  </Button>
                }
              />
            </Box>
          </Box>
        </EntityListProvider>
      </Content>
    </PageWithHeader>
  );
};
