import { useEffect, useMemo, useState } from 'react';
import { Table } from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@material-ui/core';
import SearchIcon from '@material-ui/icons/Search';
import ClearIcon from '@material-ui/icons/Close';
import ChevronLeftIcon from '@material-ui/icons/ChevronLeft';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import { useReleaseBindingPermission } from '@openchoreo/backstage-plugin-react';
import {
  useProjectContentsPage,
  useProjectContentFacets,
  useEnvironments,
  useDeploymentPipeline,
  type Environment,
  type ProjectContentItem,
  type ProjectContentKind,
  type ProjectContentsOrderBy,
} from '../hooks';
import { isMarkedForDeletion } from '../../DeleteEntity';
import { shouldNavigateOnRowClick } from '../../../utils/shouldNavigateOnRowClick';
import {
  MultiSelectFilter,
  RefreshOverlay,
  type MultiSelectGroup,
} from '@openchoreo/backstage-design-system';
import { CreateProjectContentButton } from './CreateProjectContentButton';
import { ProjectContentsEmptyState } from './ProjectContentsEmptyState';
import { buildProjectContentColumns } from './columns';
import { getKindLabel } from './kindPalette';
import { useProjectContentsCardStyles } from './styles';

const PAGE_SIZE = 5;
const KIND_ORDER: ProjectContentKind[] = ['component', 'resource'];

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export const ProjectContentsCard = () => {
  const classes = useProjectContentsCardStyles();
  const navigate = useNavigate();
  const { entity } = useEntity();

  // --- Filter / sort / paging state --------------------------------------
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput, 300);
  // null = "all" (no filtering); a concrete Set narrows to those values.
  const [selectedKinds, setSelectedKinds] = useState<Set<string> | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<Set<string> | null>(null);
  const [sort, setSort] = useState<{
    by: ProjectContentsOrderBy;
    dir: 'asc' | 'desc';
  }>({ by: 'createdAt', dir: 'desc' });
  const [cursor, setCursor] = useState<string>();
  const [pageIndex, setPageIndex] = useState(0);

  const resetToFirstPage = () => {
    setCursor(undefined);
    setPageIndex(0);
  };
  // A new search term always returns to the first page.
  useEffect(() => {
    setCursor(undefined);
    setPageIndex(0);
  }, [search]);

  // --- Data --------------------------------------------------------------
  const facets = useProjectContentFacets(entity);
  const page = useProjectContentsPage({
    systemEntity: entity,
    search,
    kinds: selectedKinds,
    types: selectedTypes,
    orderBy: sort.by,
    orderDir: sort.dir,
    cursor,
    limit: PAGE_SIZE,
  });

  const {
    environments,
    loading: envsLoading,
    isRefetching: envsRefetching,
  } = useEnvironments(entity);
  const {
    data: pipelineData,
    loading: pipelineLoading,
    error: pipelineError,
  } = useDeploymentPipeline();
  const { canViewBindings, loading: bindingsPermissionLoading } =
    useReleaseBindingPermission();

  // Environments ordered by the project's deployment pipeline.
  const pipelineEnvironments = useMemo<Environment[]>(() => {
    if (!pipelineData?.environments || environments.length === 0) {
      return [];
    }
    return pipelineData.environments
      .map((envName: string) =>
        environments.find(
          env => env.name.toLowerCase() === envName.toLowerCase(),
        ),
      )
      .filter((env: Environment | undefined): env is Environment =>
        Boolean(env),
      );
  }, [pipelineData, environments]);

  // --- Filter option data (from facets) ----------------------------------
  const kinds = useMemo(
    () => KIND_ORDER.filter(k => facets.counts[k] > 0),
    [facets.counts],
  );
  // Kind: a single flat group with per-kind counts.
  const kindGroups = useMemo<MultiSelectGroup[]>(
    () => [
      {
        options: kinds.map(k => ({
          value: k,
          label: getKindLabel(k),
          count: facets.counts[k],
        })),
      },
    ],
    [kinds, facets.counts],
  );
  // Type: one group per kind that has types.
  const typeGroups = useMemo<MultiSelectGroup[]>(
    () =>
      kinds.map(k => ({
        label: `${getKindLabel(k)} Types`,
        options: facets.typesByKind[k].map(t => ({ value: t, label: t })),
      })),
    [kinds, facets.typesByKind],
  );
  const allTypes = useMemo(
    () => [...facets.typesByKind.component, ...facets.typesByKind.resource],
    [facets.typesByKind],
  );

  const environmentsLoading =
    envsLoading || pipelineLoading || bindingsPermissionLoading;

  const columns = useMemo(
    () =>
      buildProjectContentColumns({
        environments: pipelineEnvironments,
        canViewBindings,
        pipelineError,
        environmentsLoading,
      }),
    [pipelineEnvironments, canViewBindings, pipelineError, environmentsLoading],
  );

  // --- Handlers ----------------------------------------------------------
  const handleKindsChange = (next: Set<string>) => {
    setSelectedKinds(next);
    resetToFirstPage();
  };
  const handleTypesChange = (next: Set<string>) => {
    setSelectedTypes(next);
    resetToFirstPage();
  };
  // Header clicks drive server-side ordering (columns use a no-op customSort).
  const handleOrderChange = (
    columnIndex: number,
    direction: 'asc' | 'desc',
  ) => {
    const field = columnIndex >= 0 ? columns[columnIndex]?.field : undefined;
    setSort({
      by: field === 'createdAt' ? 'createdAt' : 'name',
      dir: direction || 'asc',
    });
    resetToFirstPage();
  };

  // Rows render as soon as the catalog page returns; the Deployment column
  // skeletons independently while environments/bindings load.
  const tableLoading = page.loading;

  const rangeStart = page.items.length ? pageIndex * PAGE_SIZE + 1 : 0;
  const rangeEnd = pageIndex * PAGE_SIZE + page.items.length;

  // The project has no contents at all (vs. filters excluding everything).
  const isEmptyProject = !facets.loading && facets.counts.all === 0;

  return (
    <Box className={classes.cardWrapper} position="relative">
      <RefreshOverlay active={envsRefetching} label="Refreshing environments" />
      <Box className={classes.header}>
        <Box className={classes.titleGroup}>
          <Typography variant="h5">Project Contents</Typography>
          <span className={classes.countBadge}>{facets.counts.all}</span>
        </Box>
        {!isEmptyProject && (
          <Box className={classes.headerActions}>
            <MultiSelectFilter
              label="Kind"
              groups={kindGroups}
              allValues={kinds}
              selected={selectedKinds ?? new Set(kinds)}
              onChange={handleKindsChange}
            />
            <MultiSelectFilter
              label="Type"
              groups={typeGroups}
              allValues={allTypes}
              selected={selectedTypes ?? new Set(allTypes)}
              onChange={handleTypesChange}
            />
            <TextField
              className={classes.searchField}
              variant="outlined"
              size="small"
              placeholder="Search by name"
              value={searchInput}
              onChange={event => setSearchInput(event.target.value)}
              inputProps={{ 'aria-label': 'Search by name' }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: searchInput ? (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      aria-label="Clear filter"
                      onClick={() => setSearchInput('')}
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : undefined,
              }}
            />
            <CreateProjectContentButton entity={entity} />
          </Box>
        )}
      </Box>

      {isEmptyProject ? (
        <ProjectContentsEmptyState entity={entity} />
      ) : (
        <>
          <Box className={classes.tableScroll}>
            <Table<ProjectContentItem>
              columns={columns}
              data={page.items}
              isLoading={tableLoading}
              onOrderChange={handleOrderChange}
              onRowClick={(event, rowData) => {
                if (
                  !rowData ||
                  !shouldNavigateOnRowClick(event) ||
                  isMarkedForDeletion(rowData.entity)
                ) {
                  return;
                }
                const ns = rowData.entity.metadata.namespace || 'default';
                navigate(`/catalog/${ns}/${rowData.kind}/${rowData.name}`);
              }}
              emptyContent={
                <Box p={3}>
                  <Typography
                    variant="body1"
                    color="textSecondary"
                    align="center"
                  >
                    No components or resources match the current filters
                  </Typography>
                </Box>
              }
              options={{
                paging: false,
                sorting: true,
                thirdSortClick: false,
                search: false,
                toolbar: false,
                draggable: false,
                padding: 'dense',
                tableLayout: 'fixed',
              }}
              style={{ width: '100%', minWidth: 950, boxShadow: 'none' }}
            />
          </Box>

          {page.totalItems > 0 && (
            <Box className={classes.pager}>
              <Typography className={classes.pagerLabel}>
                {rangeStart}–{rangeEnd} of {page.totalItems}
              </Typography>
              <IconButton
                size="small"
                aria-label="Previous page"
                disabled={!page.prevCursor || tableLoading}
                onClick={() => {
                  setCursor(page.prevCursor);
                  setPageIndex(p => Math.max(0, p - 1));
                }}
              >
                <ChevronLeftIcon />
              </IconButton>
              <IconButton
                size="small"
                aria-label="Next page"
                disabled={!page.nextCursor || tableLoading}
                onClick={() => {
                  setCursor(page.nextCursor);
                  setPageIndex(p => p + 1);
                }}
              >
                <ChevronRightIcon />
              </IconButton>
            </Box>
          )}
        </>
      )}
    </Box>
  );
};
