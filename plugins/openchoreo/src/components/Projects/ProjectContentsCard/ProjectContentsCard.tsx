import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Entity } from '@backstage/catalog-model';
import { Table } from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useNavigate } from 'react-router-dom';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import {
  Box,
  IconButton,
  InputAdornment,
  TextField,
  Tooltip,
  Typography,
} from '@material-ui/core';
import SearchIcon from '@material-ui/icons/Search';
import ClearIcon from '@material-ui/icons/Close';
import ChevronLeftIcon from '@material-ui/icons/ChevronLeft';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import RefreshIcon from '@material-ui/icons/Refresh';
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
import {
  isMarkedForDeletion,
  useDeleteComponentDialog,
} from '../../DeleteEntity';
import { shouldNavigateOnRowClick } from '../../../utils/shouldNavigateOnRowClick';
import {
  MultiSelectFilter,
  RefreshOverlay,
  Skeleton,
  type MultiSelectGroup,
} from '@openchoreo/backstage-design-system';
import { CreateProjectContentButton } from './CreateProjectContentButton';
import { ProjectContentsEmptyState } from './ProjectContentsEmptyState';
import { buildProjectContentColumns } from './columns';
import { getKindLabel } from './kindPalette';
import { useProjectContentsCardStyles } from './styles';

const PAGE_SIZE = 5;
const KIND_ORDER: ProjectContentKind[] = ['component', 'resource'];

/** Stable identity for a content row, independent of object reference. */
const entityKey = (entity: Entity): string =>
  `${entity.kind.toLowerCase()}:${entity.metadata.namespace || 'default'}/${
    entity.metadata.name
  }`;

/**
 * Mark a row as deleted in the UI immediately, before the catalog re-ingests
 * the deletion. The listing reads "marked for deletion" from the catalog
 * entity's annotation, but a delete only updates the control plane — the
 * catalog lags by a sync/event. We inject the annotation locally so the badge
 * shows right away (the entity page gets the same effect by querying the OC
 * API directly).
 */
const withOptimisticDeletion = (item: ProjectContentItem): ProjectContentItem =>
  isMarkedForDeletion(item.entity)
    ? item
    : {
        ...item,
        entity: {
          ...item.entity,
          metadata: {
            ...item.entity.metadata,
            annotations: {
              ...(item.entity.metadata.annotations ?? {}),
              [CHOREO_ANNOTATIONS.DELETION_TIMESTAMP]: new Date().toISOString(),
            },
          },
        },
      };

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
  // Drives the Refresh icon's spin + disabled state while an explicit refresh
  // (page rows + facet counts) is in flight.
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Bumped after a component is marked for deletion to re-fetch the page.
  const [refreshToken, setRefreshToken] = useState(0);
  // Rows deleted from the listing this session — marked optimistically until
  // the catalog catches up (keyed by entity identity, not object reference).
  const [pendingDeletions, setPendingDeletions] = useState<Set<string>>(
    () => new Set(),
  );

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
    refreshToken,
  });

  // Row-level component delete. On success we (1) optimistically mark the row
  // so the "marked for deletion" badge shows immediately, and (2) re-fetch so
  // the row eventually drops off once the catalog removes the component.
  const handleDeleted = useCallback((deletedEntity: Entity) => {
    setPendingDeletions(prev => {
      const next = new Set(prev);
      next.add(entityKey(deletedEntity));
      return next;
    });
    setRefreshToken(token => token + 1);
  }, []);
  const { requestDelete, DeleteDialog } = useDeleteComponentDialog({
    onDeleted: handleDeleted,
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
        onDeleteComponent: item => requestDelete(item.entity),
      }),
    [
      pipelineEnvironments,
      canViewBindings,
      pipelineError,
      environmentsLoading,
      requestDelete,
    ],
  );

  // Apply optimistic deletion marks on top of the fetched page.
  const displayItems = useMemo(
    () =>
      pendingDeletions.size === 0
        ? page.items
        : page.items.map(item =>
            pendingDeletions.has(entityKey(item.entity))
              ? withOptimisticDeletion(item)
              : item,
          ),
    [page.items, pendingDeletions],
  );

  // --- Handlers ----------------------------------------------------------
  // Manual refresh: re-run the contents page (rows + deployment status) and the
  // facet queries (counts + type options). Spins the icon until both settle.
  const handleRefresh = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    Promise.all([page.refetch(), facets.refetch()]).finally(() =>
      setIsRefreshing(false),
    );
  };

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
  // skeletons independently while environments/bindings load. `keepPreviousData`
  // holds the prior page on screen during a page change (loading stays false,
  // isRefetching flips true), so guard the pager/row-clicks on both.
  const tableLoading = page.loading || page.isRefetching;

  const rangeStart = page.items.length ? pageIndex * PAGE_SIZE + 1 : 0;
  const rangeEnd = pageIndex * PAGE_SIZE + page.items.length;

  // Keep the widget from shrinking on a short last page. Once a full page has
  // rendered, lock its measured height so navigating to a page with fewer than
  // PAGE_SIZE rows reserves the same space instead of the card jumping. Measured
  // (not a hardcoded row height) so it stays correct across themes/row content;
  // only grows (Math.max) so async deployment chips never under-reserve.
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [fullPageHeight, setFullPageHeight] = useState<number>();
  useLayoutEffect(() => {
    if (page.items.length === PAGE_SIZE && tableScrollRef.current) {
      const measured = tableScrollRef.current.offsetHeight;
      setFullPageHeight(prev =>
        prev === undefined ? measured : Math.max(prev, measured),
      );
    }
  }, [page.items]);
  // Reserve height only when there's more than one page to move between.
  const reservedHeight =
    page.totalItems > PAGE_SIZE ? fullPageHeight : undefined;

  // The project has no contents at all (vs. filters excluding everything).
  const isEmptyProject = !facets.loading && facets.counts.all === 0;

  // Track whether the card has ever finished a load. Using `items.length === 0`
  // to detect the initial load misfires when a filter yields 0 rows and is then
  // changed — the refetch (loading + empty items) would look like a first load
  // and unmount the header controls (incl. the search field being typed in).
  const hasLoadedOnce = useRef(false);
  useEffect(() => {
    if (!page.loading && !facets.loading) {
      hasLoadedOnce.current = true;
    }
  }, [page.loading, facets.loading]);

  // First load — we don't yet know if this resolves to a table or the empty
  // state, so show a neutral card skeleton rather than a table-shaped one.
  const initialLoading =
    !isEmptyProject &&
    !hasLoadedOnce.current &&
    (facets.loading || page.loading);

  const showTable = !isEmptyProject && !initialLoading;

  return (
    <Box className={classes.cardWrapper} position="relative">
      <RefreshOverlay active={envsRefetching} label="Refreshing environments" />
      <Box className={classes.header}>
        <Box className={classes.titleGroup}>
          {initialLoading ? (
            <Skeleton variant="text" width={150} height={28} />
          ) : (
            <>
              <Typography variant="h5">Project Contents</Typography>
              <span className={classes.countBadge}>{facets.counts.all}</span>
              <Tooltip title={isRefreshing ? 'Refreshing…' : 'Refresh'}>
                <span>
                  <IconButton
                    className={classes.refreshButton}
                    size="small"
                    aria-label="Refresh project contents"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                  >
                    <RefreshIcon
                      className={`${classes.refreshIcon} ${
                        isRefreshing ? classes.spinning : ''
                      }`}
                    />
                  </IconButton>
                </span>
              </Tooltip>
            </>
          )}
        </Box>
        {showTable && (
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

      {isEmptyProject && <ProjectContentsEmptyState entity={entity} />}

      {initialLoading && (
        <Box className={classes.skeletonBody}>
          <Skeleton variant="rect" width="100%" height={240} />
        </Box>
      )}

      {showTable && (
        <>
          <div
            className={classes.tableScroll}
            ref={tableScrollRef}
            style={reservedHeight ? { minHeight: reservedHeight } : undefined}
          >
            <Table<ProjectContentItem>
              columns={columns}
              data={displayItems}
              isLoading={false}
              onOrderChange={handleOrderChange}
              onRowClick={(event, rowData) => {
                if (
                  tableLoading ||
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
          </div>

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

      <DeleteDialog />
    </Box>
  );
};
