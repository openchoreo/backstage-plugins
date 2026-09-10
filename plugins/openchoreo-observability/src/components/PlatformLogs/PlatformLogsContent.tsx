import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Typography } from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import {
  PageLoader,
  RefreshOverlay,
} from '@openchoreo/backstage-design-system';
import {
  ForbiddenState,
  usePlatformLogsPermission,
} from '@openchoreo/backstage-plugin-react';
import {
  useObservabilityPlanes,
  usePlatformLogFacets,
  usePlatformLogs,
  useUrlFiltersForPlatformLogs,
} from '../../hooks';
import { PlatformLogsFilterRow } from './PlatformLogsFilterRow';
import { PlatformLogsResultBar } from './PlatformLogsResultBar';
import { PlatformLogsTable } from './PlatformLogsTable';
import { PlatformLogsToolbar } from './PlatformLogsToolbar';

const PAGE_SIZE = 50;

const PlatformLogsView = () => {
  const { filters, updateFilters } = useUrlFiltersForPlatformLogs();
  const {
    planes,
    loading: planesLoading,
    error: planesError,
  } = useObservabilityPlanes();

  // Deliberately not in the URL and not remembered: the page always opens with the
  // filters folded, so the first thing anyone sees is logs rather than controls. A
  // shared link then looks the same for whoever opens it, and the chips carry what is
  // actually applied.
  const [filtersOpen, setFiltersOpen] = useState(false);

  const selectedPlane = useMemo(
    () => planes.find(p => p.ref === filters.observabilityPlane),
    [planes, filters.observabilityPlane],
  );

  // Land on a plane rather than an empty page. Most installs have exactly one, and
  // with none selected there is nothing to query and nothing to look at.
  useEffect(() => {
    if (!planesLoading && planes.length > 0 && !selectedPlane) {
      updateFilters({ observabilityPlane: planes[0].ref });
    }
  }, [planesLoading, planes, selectedPlane, updateFilters]);

  const {
    logs,
    loading,
    isRefetching,
    error,
    totalCount,
    hasMore,
    loadMore,
    refresh,
  } = usePlatformLogs(selectedPlane?.observerUrl, filters, PAGE_SIZE);

  const facets = usePlatformLogFacets(logs, filters);

  if (planesLoading) {
    return <PageLoader />;
  }

  if (planesError) {
    return <Alert severity="error">{planesError}</Alert>;
  }

  if (planes.length === 0) {
    return (
      <Alert severity="info">
        No observability planes are registered. Platform logs are served by an
        observability plane's Observer API, so there is nothing to query yet.
      </Alert>
    );
  }

  const planeMissingObserver = selectedPlane && !selectedPlane.observerUrl;

  return (
    <Box position="relative">
      {/* Suppressed while tailing: the 5s poll would otherwise flash it constantly. */}
      <RefreshOverlay
        active={isRefetching && !filters.isLive}
        label="Refreshing logs"
      />

      <PlatformLogsToolbar
        filters={filters}
        onFiltersChange={updateFilters}
        planes={planes}
        planesLoading={planesLoading}
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen(open => !open)}
        onRefresh={refresh}
        disabled={loading}
      />

      <PlatformLogsFilterRow
        open={filtersOpen}
        filters={filters}
        onFiltersChange={updateFilters}
        facets={facets}
        disabled={loading}
      />

      {planeMissingObserver && (
        <Box mt={2}>
          <Alert severity="warning">
            <Typography variant="body2">
              {selectedPlane?.displayName} does not publish an Observer URL, so
              it cannot be queried.
            </Typography>
          </Alert>
        </Box>
      )}

      {error && (
        <Box mt={2}>
          <Alert
            severity="error"
            action={
              <Button onClick={refresh} color="inherit" size="small">
                Retry
              </Button>
            }
          >
            {error}
          </Alert>
        </Box>
      )}

      {!planeMissingObserver && (
        <>
          <PlatformLogsResultBar
            totalCount={totalCount}
            filters={filters}
            onFiltersChange={updateFilters}
            disabled={loading}
          />

          <PlatformLogsTable
            selectedFields={filters.selectedFields}
            logs={logs}
            loading={loading}
            hasMore={hasMore}
            onLoadMore={loadMore}
          />
        </>
      )}
    </Box>
  );
};

/**
 * Platform (system component) logs, behind the cluster-scoped view permission.
 *
 * Exported without page chrome — no `<Page>`, `<Header>` or `<Content>` — so the host
 * decides where it is mounted. In the OpenChoreo portal that is the Logs tab of the
 * Platform section.
 *
 * Not nested under a project or component, and deliberately not a tab on Plane entity
 * pages: the plane is expressed as a label filter like any other, which is also what
 * lets an operator find components OpenChoreo does not ship (they carry no plane
 * label at all).
 */
export const PlatformLogsContent = () => {
  const { canViewPlatformLogs, loading, deniedTooltip, permissionName } =
    usePlatformLogsPermission();

  if (loading) {
    return <PageLoader />;
  }

  if (!canViewPlatformLogs) {
    return (
      <ForbiddenState
        message={deniedTooltip}
        permissionName={permissionName}
        variant="fullpage"
      />
    );
  }

  return <PlatformLogsView />;
};
