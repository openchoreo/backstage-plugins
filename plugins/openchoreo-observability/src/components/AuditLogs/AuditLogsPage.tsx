import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Box, Grid, Typography } from '@material-ui/core';
import { Content, EmptyState, Header, Page } from '@backstage/core-components';
import { Alert } from '@material-ui/lab';
import {
  ForbiddenState,
  TimeRangeFilter,
  useAuditLogsPermission,
} from '@openchoreo/backstage-plugin-react';
import {
  PageLoader,
  RefreshOverlay,
} from '@openchoreo/backstage-design-system';
import {
  AuditLogsForbiddenError,
  AuditLogsNotEnabledError,
  AuditLogsNotSupportedError,
} from '../../api/AuditLogsErrors';
import { useAuditEvent } from '../../hooks/useAuditEvent';
import { useAuditLogs } from '../../hooks/useAuditLogs';
import { useAuditQuerySummary } from '../../hooks/useAuditQuerySummary';
import { useUrlFiltersForAuditLogs } from '../../hooks/useUrlFiltersForAuditLogs';
import { AuditLogsActions } from './AuditLogsActions';
import { AuditLogsTable } from './AuditLogsTable';
import { AuditQueryBar } from './AuditQueryBar';
import { resolveAuditWindow } from './query';
import { useAuditPageStyles } from './styles';
import { AuditFilterPath, AuditLogRecord, AuditSortOrder } from './types';

// The drawer is only opened on a click, so it does not belong in the bundle a
// reader of the table has to download.
const AuditEventDrawer = lazy(() => import('./AuditEventDrawer'));

/**
 * The audit trail: who changed what, where, and whether it was allowed.
 *
 * A top-level page rather than an entity tab, because the trail spans every
 * namespace and reading it is gated at cluster scope — the tenancy filters
 * narrow a query without widening what the caller may read.
 */
export const AuditLogsPage = () => {
  const classes = useAuditPageStyles();

  const {
    filters,
    updateFilters,
    toggleToken,
    removeToken,
    addToken,
    clearTokens,
    selectEvent,
  } = useUrlFiltersForAuditLogs();

  const {
    canViewAuditLogs,
    loading: permissionLoading,
    permissionName,
  } = useAuditLogsPermission();

  // Live is session state rather than a URL parameter: a shared link should
  // open on the window it was taken from, not start polling in someone else's
  // browser.
  const [isLive, setIsLive] = useState(false);
  // Bumped by Refresh. It both recomputes a relative window against the clock
  // and re-keys the queries — a custom window resolves to the same timestamps
  // every time, so the key would otherwise be unchanged and Refresh would be
  // answered from cache.
  const [windowGeneration, setWindowGeneration] = useState(0);

  const auditWindow = useMemo(
    () =>
      resolveAuditWindow(filters.timeRange, {
        startTime: filters.customStartTime,
        endTime: filters.customEndTime,
      }),
    // A relative range resolves against "now", so it is pinned per generation:
    // recomputing it on every render would shift the window under the cursor
    // and re-key the query on each keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      filters.timeRange,
      filters.customStartTime,
      filters.customEndTime,
      windowGeneration,
    ],
  );

  const summary = useAuditQuerySummary({
    window: auditWindow,
    tokens: filters.tokens,
    isLive,
    generation: windowGeneration,
    enabled: canViewAuditLogs,
  });

  const records = useAuditLogs({
    window: auditWindow,
    tokens: filters.tokens,
    sortOrder: filters.sortOrder,
    isLive,
    generation: windowGeneration,
    enabled: canViewAuditLogs,
  });

  // Stamped only on the fetching→settled transition. In an audit view "when did
  // I last see the truth" is the question this answers, so a render caused by
  // opening a picker or selecting a row must not advance it.
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const fetching =
    records.loading ||
    records.isRefetching ||
    summary.loading ||
    summary.isRefetching;
  const wasFetching = useRef(fetching);
  useEffect(() => {
    if (wasFetching.current && !fetching) setLastUpdated(new Date());
    wasFetching.current = fetching;
  }, [fetching]);

  const handleRefresh = useCallback(() => {
    setWindowGeneration(generation => generation + 1);
  }, []);

  // Live polls the first page, which oldest-first means the start of the
  // window — it would sit on week-old records and never show new activity. So
  // turning it on also flips the order, visibly, rather than querying one way
  // while the sort button claims the other. Turning it on also starts a new
  // generation so polling begins from the newest page; turning it off keeps the
  // generation, so the records already fetched stay and only the polling stops.
  const handleLiveChange = useCallback(
    (next: boolean) => {
      setIsLive(next);
      if (next) {
        setWindowGeneration(generation => generation + 1);
        updateFilters({ sortOrder: 'desc' });
      }
    },
    [updateFilters],
  );

  // Oldest-first stops Live rather than overriding the order just asked for.
  const handleSortOrderChange = useCallback(
    (sortOrder: AuditSortOrder) => {
      if (sortOrder === 'asc') setIsLive(false);
      updateFilters({ sortOrder });
    },
    [updateFilters],
  );

  const handleAddToken = useCallback(
    (path: AuditFilterPath, value: string) => addToken(path, value),
    [addToken],
  );

  const loadedRecord = useMemo(
    () =>
      filters.selectedEventId
        ? records.records.find(
            record => record.event_id === filters.selectedEventId,
          )
        : undefined,
    [filters.selectedEventId, records.records],
  );

  // A link carries the event id but not the page it was on.
  const { record: fetchedRecord } = useAuditEvent({
    window: auditWindow,
    eventId: filters.selectedEventId,
    enabled: canViewAuditLogs && !loadedRecord,
  });

  // Held rather than looked up each render: a refetch empties the list briefly,
  // and the record need not return on the first page of a narrowed query.
  const [selectedRecord, setSelectedRecord] = useState<
    AuditLogRecord | undefined
  >(undefined);
  useEffect(() => {
    const record = loadedRecord ?? fetchedRecord;
    if (!filters.selectedEventId) setSelectedRecord(undefined);
    else if (record?.event_id === filters.selectedEventId) {
      setSelectedRecord(record);
    }
  }, [filters.selectedEventId, loadedRecord, fetchedRecord]);

  // Guarded so picking a different row never shows the previous record.
  const drawerRecord =
    selectedRecord?.event_id === filters.selectedEventId
      ? selectedRecord
      : undefined;

  const error = records.error ?? summary.error;
  const notEnabled = error instanceof AuditLogsNotEnabledError;
  const notSupported = error instanceof AuditLogsNotSupportedError;
  const forbidden = error instanceof AuditLogsForbiddenError;

  const body = () => {
    if (permissionLoading) return <PageLoader />;

    if (!canViewAuditLogs || forbidden) {
      return (
        <ForbiddenState
          message="You do not have permission to view audit logs."
          permissionName={permissionName}
          variant="fullpage"
        />
      );
    }

    if (notEnabled) {
      return (
        <EmptyState
          missing="info"
          title="Audit Logs Disabled"
          description="The audit logs feature is currently disabled."
        />
      );
    }

    if (notSupported) {
      return (
        <EmptyState
          missing="info"
          title="This deployment cannot be queried for audit records"
          description="Records are still being written. The configured logs adapter just does not answer audit queries. Deployments that forward their trail to an external SIEM and keep no local copy land here too."
        />
      );
    }

    return (
      <>
        <Grid container spacing={2} alignItems="flex-start">
          <Grid item xs={12} md>
            <AuditQueryBar
              tokens={filters.tokens}
              window={auditWindow}
              onToggleToken={toggleToken}
              onRemoveToken={removeToken}
              onClear={clearTokens}
            />
          </Grid>
          <Grid item xs={12} md="auto" className={classes.timeRangeItem}>
            <TimeRangeFilter
              value={filters.timeRange}
              customStartTime={filters.customStartTime}
              customEndTime={filters.customEndTime}
              onChange={next => updateFilters(next)}
              size="small"
            />
          </Grid>
        </Grid>

        {auditWindow.clamped && (
          <Alert severity="info" className={classes.windowNotice}>
            A query covers at most 366 days, so this one starts{' '}
            {new Date(auditWindow.startTime).toLocaleDateString()}. Go back
            further a year at a time.
          </Alert>
        )}

        {error && (
          <Alert severity="error" className={classes.errorContainer}>
            {error.message}
          </Alert>
        )}

        <AuditLogsActions
          total={summary.total}
          loaded={records.records.length}
          sortOrder={filters.sortOrder}
          onSortOrderChange={handleSortOrderChange}
          isLive={isLive}
          onLiveChange={handleLiveChange}
          onRefresh={handleRefresh}
          lastUpdated={lastUpdated}
          columns={filters.columns}
          onColumnsChange={columns => updateFilters({ columns })}
        />

        <Box position="relative">
          <RefreshOverlay
            active={records.isRefetching}
            label="Refreshing audit records"
          />
          <AuditLogsTable
            records={records.records}
            columns={filters.columns}
            loading={records.loading || records.loadingMore}
            hasMore={records.hasMore}
            onLoadMore={records.loadMore}
            selectedEventId={filters.selectedEventId}
            onSelect={selectEvent}
            onClearFilters={clearTokens}
            hasFilters={filters.tokens.length > 0}
          />
        </Box>

        {isLive && (
          <Typography variant="caption" color="textSecondary" display="block">
            Live: checking for new events every 10 seconds. Turn it off to load
            older records.
          </Typography>
        )}

        <Suspense fallback={null}>
          <AuditEventDrawer
            record={drawerRecord}
            open={Boolean(drawerRecord)}
            onClose={() => selectEvent(undefined)}
            onAddToken={handleAddToken}
          />
        </Suspense>
      </>
    );
  };

  return (
    <Page themeId="tool">
      <Header
        title="Audit Logs"
        subtitle="Who changed what, where, and whether it was allowed"
      />
      <Content>{body()}</Content>
    </Page>
  );
};

export default AuditLogsPage;
