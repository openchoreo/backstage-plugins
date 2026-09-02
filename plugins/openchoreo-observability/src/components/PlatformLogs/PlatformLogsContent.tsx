import { useEffect, useMemo } from 'react';
import { Box, Typography, Button } from '@material-ui/core';
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
import { PlatformLogsFilter } from './PlatformLogsFilter';
import { PlatformLogsTable } from './PlatformLogsTable';
import { useRuntimeLogsStyles } from '../RuntimeLogs/styles';

const PAGE_SIZE = 50;

const PlatformLogsView = () => {
  const classes = useRuntimeLogsStyles();
  const { filters, updateFilters } = useUrlFiltersForPlatformLogs();
  const {
    planes,
    loading: planesLoading,
    error: planesError,
  } = useObservabilityPlanes();

  const selectedPlane = useMemo(
    () => planes.find(p => p.name === filters.observabilityPlane),
    [planes, filters.observabilityPlane],
  );

  // Land on a plane rather than an empty page. Most installs have exactly one, and
  // with none selected there is nothing to query and nothing to look at.
  useEffect(() => {
    if (!planesLoading && planes.length > 0 && !selectedPlane) {
      updateFilters({ observabilityPlane: planes[0].name });
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

  const facets = usePlatformLogFacets(logs, filters.observabilityPlane);

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
      <RefreshOverlay active={isRefetching} label="Refreshing logs" />

      <PlatformLogsFilter
        filters={filters}
        onFiltersChange={updateFilters}
        planes={planes}
        planesLoading={planesLoading}
        facets={facets}
        disabled={loading}
      />

      {planeMissingObserver && (
        <Alert severity="warning" className={classes.errorContainer}>
          <Typography variant="body1">
            {selectedPlane?.displayName} does not publish an Observer URL, so it
            cannot be queried.
          </Typography>
        </Alert>
      )}

      {error && (
        <Alert severity="error" className={classes.errorContainer}>
          <Typography variant="body1">{error}</Typography>
          <Button onClick={refresh} color="inherit" size="small">
            Retry
          </Button>
        </Alert>
      )}

      {!planeMissingObserver && (
        <>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            my={2}
          >
            <Typography variant="body2" color="textSecondary">
              {totalCount} {totalCount === 1 ? 'entry' : 'entries'}
            </Typography>
            <Button onClick={refresh} size="small" disabled={loading}>
              Refresh
            </Button>
          </Box>

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
