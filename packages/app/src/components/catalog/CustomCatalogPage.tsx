import { useState } from 'react';
import { Box, Drawer, Button, Grid } from '@material-ui/core';
import FilterListIcon from '@material-ui/icons/FilterList';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { useRouteRef } from '@backstage/core-plugin-api';
import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { Link } from 'react-router-dom';
import { PageWithHeader, Content } from '@backstage/core-components';
import {
  EntityListProvider,
  EntityLifecyclePicker,
  EntityNamespacePicker,
  EntityProcessingStatusPicker,
  EntityTagPicker,
} from '@backstage/plugin-catalog-react';
import { ChoreoEntityKindPicker } from './ChoreoEntityKindPicker';
import { StarredFilter } from './CustomPersonalFilters';
import { CatalogCardList } from './CatalogCardList';
import { useStyles } from './styles';

export interface CustomCatalogPageProps {
  initialKind?: string;
  initiallySelectedNamespaces?: string[];
}

export const CustomCatalogPage = ({
  initialKind = 'system',
  initiallySelectedNamespaces,
}: CustomCatalogPageProps) => {
  const classes = useStyles();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const createComponentLink = useRouteRef(scaffolderPlugin.routes.root);

  return (
    <PageWithHeader title="OpenChoreo Catalog" themeId="home">
      <Content>
        <EntityListProvider pagination={{ mode: 'offset', limit: 25 }}>
          <Box className={classes.root}>
            {/* Header with Filter button and Create button */}
            <Box className={classes.header}>
              <Box display="flex" justifyContent="flex-start">
                {/* Filter button for mobile */}
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

              {/* Create button */}
              <Button
                variant="contained"
                color="primary"
                component={Link}
                to={createComponentLink()}
                className={classes.createButton}
              >
                Create
              </Button>
            </Box>

            {/* Filters at the top (desktop) */}
            <Box className={classes.filterSection}>
              <Grid container spacing={2}>
                <Grid item sm={12} md={4} lg={2}>
                  <EntityNamespacePicker
                    initiallySelectedNamespaces={initiallySelectedNamespaces}
                  />
                </Grid>
                <Grid item sm={12} md={4} lg={2}>
                  <ChoreoEntityKindPicker initialFilter={initialKind} />
                </Grid>
              </Grid>

              {/* Advanced Filters Toggle Button */}
              <Box
                display="flex"
                justifyContent="flex-start"
                mt={1}
                mb={advancedFiltersOpen ? 1 : 0}
              >
                <button
                  className={classes.advancedFiltersToggle}
                  onClick={() => setAdvancedFiltersOpen(!advancedFiltersOpen)}
                >
                  Advanced Filters
                  <ExpandMoreIcon
                    fontSize="small"
                    className={`${classes.advancedFiltersIcon} ${
                      advancedFiltersOpen ? classes.advancedFiltersExpanded : ''
                    }`}
                  />
                </button>
              </Box>

              {/* Advanced Filters Grid - Shown when expanded, inside same section */}
              {advancedFiltersOpen && (
                <Grid container spacing={2}>
                  <Grid item sm={12} md={4} lg={2}>
                    <EntityTagPicker />
                  </Grid>
                  <Grid
                    item
                    sm={12}
                    md={4}
                    lg={2}
                    className={classes.hideWhenEmpty}
                  >
                    <EntityLifecyclePicker />
                  </Grid>
                  <Grid item sm={12} md={4} lg={2}>
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
                    <EntityNamespacePicker
                      initiallySelectedNamespaces={initiallySelectedNamespaces}
                    />
                  </Box>
                  <Box className={classes.filterItem}>
                    <ChoreoEntityKindPicker initialFilter={initialKind} />
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

            {/* Catalog card list */}
            <Box className={classes.contentArea}>
              <CatalogCardList />
            </Box>
          </Box>
        </EntityListProvider>
      </Content>
    </PageWithHeader>
  );
};
