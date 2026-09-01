import { FC, useCallback } from 'react';
import { Paper, Box, Typography, CircularProgress } from '@material-ui/core';
import { Skeleton } from '@openchoreo/backstage-design-system';
import {
  VirtualizedLogList,
  useAutoLoadWhenEmpty,
  useRowExpansion,
} from '@openchoreo/backstage-plugin-react';
import { useLogsTableStyles } from '../RuntimeLogs/styles';
import { PlatformLogEntryRow } from './PlatformLogEntryRow';
import { getPlatformColumnStyle } from './columns';
import { PlatformLogEntry, PlatformLogField } from './types';

interface PlatformLogsTableProps {
  selectedFields: PlatformLogField[];
  logs: PlatformLogEntry[];
  loading: boolean;
  hasMore: boolean;
  /** Called when the user scrolls near the end of the list. */
  onLoadMore: () => void;
}

// Matches the runtime logs table: full viewport minus the header, filters and
// actions bars above it.
const LOGS_HEIGHT = 'calc(100vh - 320px)';

export const PlatformLogsTable: FC<PlatformLogsTableProps> = ({
  selectedFields,
  logs,
  loading,
  hasMore,
  onLoadMore,
}) => {
  const classes = useLogsTableStyles();

  // Tracked here rather than inside the row so expansion survives the virtualizer
  // unmounting rows that scroll off-screen.
  const { expanded, toggle } = useRowExpansion();

  // The virtualizer renders no load-more sentinel when the list is empty, so the
  // "0 rows but hasMore" case has to be driven explicitly.
  useAutoLoadWhenEmpty({ count: logs.length, hasMore, loading, onLoadMore });

  const getRowKey = useCallback(
    (index: number) => `${logs[index].timestamp}-${index}`,
    [logs],
  );

  const header = (
    <Box className={classes.headerRow} role="row">
      {selectedFields.map(field => (
        <Box
          key={field}
          role="columnheader"
          style={getPlatformColumnStyle(field)}
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
            style={getPlatformColumnStyle(field)}
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
        Try widening the time range, or clearing the label selector to search
        everything this observability plane holds.
      </Typography>
    </Box>
  );

  return (
    <Paper
      className={classes.tablePaper}
      role="table"
      aria-label="Platform logs"
    >
      {logs.length === 0 ? (
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
              <PlatformLogEntryRow
                log={logs[index]}
                selectedFields={selectedFields}
                expanded={expanded.has(key)}
                onToggleExpand={() => toggle(key)}
              />
            );
          }}
        />
      )}
    </Paper>
  );
};
