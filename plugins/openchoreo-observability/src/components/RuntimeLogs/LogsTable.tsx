import { FC, useCallback, useEffect, useRef } from 'react';
import { Paper, Box, Typography, CircularProgress } from '@material-ui/core';
import { Skeleton } from '@openchoreo/backstage-design-system';
import {
  VirtualizedLogList,
  useAutoLoadWhenEmpty,
  useRowExpansion,
} from '@openchoreo/backstage-plugin-react';
import { LogEntryField, LogEntry as LogEntryType } from './types';
import { LogEntry, RenderLogRowAction } from './LogEntry';
import { useLogsTableStyles } from './styles';
import { getColumnStyle } from './columns';

interface LogsTableProps {
  selectedFields: LogEntryField[];
  logs: LogEntryType[];
  loading: boolean;
  hasMore: boolean;
  /** Called when the user scrolls near the end of the list. */
  onLoadMore: () => void;
  environmentName?: string;
  projectName?: string;
  componentName?: string;
  renderRowAction?: RenderLogRowAction;
}

// Matches the height the table scroll area used to have (full viewport minus
// the header, filters and actions bars above it).
const LOGS_HEIGHT = 'calc(100vh - 320px)';

export const LogsTable: FC<LogsTableProps> = ({
  selectedFields,
  logs,
  loading,
  hasMore,
  onLoadMore,
  environmentName,
  projectName,
  componentName,
  renderRowAction,
}) => {
  const classes = useLogsTableStyles();

  // Expanded rows are tracked here (not inside <LogEntry>) so the state
  // survives the virtualizer unmounting rows that scroll off-screen.
  const { expanded, toggle } = useRowExpansion();

  // The virtualizer doesn't render a load-more sentinel when the list is
  // empty, so the auto-fetch behaviour the old IntersectionObserver gave us
  // has to be re-created explicitly for the "0 rows but hasMore=true" case.
  useAutoLoadWhenEmpty({
    count: logs.length,
    hasMore,
    loading,
    onLoadMore,
  });
  const getRowKey = useCallback(
    (index: number) => `${logs[index].timestamp}-${index}`,
    [logs],
  );

  // Ref-backed snapshot accessor so per-row buttons (the host-supplied
  // `renderRowAction` — e.g. "Investigate in assistant") can read the
  // *current* logs list without their parent component re-rendering every
  // time a new log batch arrives. Each LogEntry receives a stable callback
  // reference; only the rows whose own props change re-render. The ref is
  // updated after every render so the closure always returns the freshest
  // list.
  const logsRef = useRef<LogEntryType[]>(logs);
  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);
  const getLogsSnapshot = useCallback(() => logsRef.current, []);

  const header = (
    <Box className={classes.headerRow} role="row">
      {selectedFields.map(field => (
        <Box
          key={field}
          role="columnheader"
          style={getColumnStyle(field)}
          className={classes.headerColumn}
        >
          {field}
        </Box>
      ))}
    </Box>
  );

  const footer = hasMore ? (
    <div className={classes.loadingContainer}>
      {loading ? (
        <Box display="flex" alignItems="center" role="status" aria-busy="true">
          <CircularProgress size={20} aria-hidden="true" />
          <Typography variant="body2" style={{ marginLeft: 8 }}>
            Loading more logs...
          </Typography>
        </Box>
      ) : (
        <Typography variant="body2" color="textSecondary">
          Scroll to load more logs
        </Typography>
      )}
    </div>
  ) : null;

  const renderLoadingSkeletons = () =>
    Array.from({ length: 5 }).map((_, index) => (
      <Box key={`skeleton-${index}`} className={classes.skeletonRow}>
        {selectedFields.map(field => (
          <Box
            key={field}
            style={getColumnStyle(field)}
            className={classes.cell}
          >
            <Skeleton variant="text" width="100%" />
          </Box>
        ))}
      </Box>
    ));

  const renderEmptyState = () => (
    <Box className={classes.emptyState}>
      <Typography variant="h6" gutterBottom>
        No logs found
      </Typography>
      <Typography variant="body2">
        Try adjusting your filters or time range to see more logs.
      </Typography>
    </Box>
  );

  return (
    <Paper
      className={classes.tablePaper}
      role="table"
      aria-label="Runtime logs"
    >
      {logs.length === 0 ? (
        // No footer when empty: "Loading more logs…" misleads on the initial
        // load, and "Scroll to load more" is meaningless when there's nothing
        // to scroll. The auto-load is driven by `useAutoLoadWhenEmpty` above.
        <>
          {header}
          {loading ? renderLoadingSkeletons() : renderEmptyState()}
        </>
      ) : (
        <VirtualizedLogList
          itemCount={logs.length}
          maxHeight={LOGS_HEIGHT}
          estimatedRowHeight={32}
          getItemKey={getRowKey}
          hasMore={hasMore}
          loading={loading}
          onReachEnd={onLoadMore}
          header={header}
          footer={footer}
          renderRow={index => {
            const key = getRowKey(index);
            return (
              <LogEntry
                log={logs[index]}
                selectedFields={selectedFields}
                environmentName={environmentName}
                projectName={projectName}
                componentName={componentName}
                expanded={expanded.has(key)}
                onToggleExpand={() => toggle(key)}
                getLogsSnapshot={getLogsSnapshot}
                renderRowAction={renderRowAction}
              />
            );
          }}
        />
      )}
    </Paper>
  );
};
