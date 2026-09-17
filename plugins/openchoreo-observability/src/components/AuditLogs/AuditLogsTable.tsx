import { useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Paper,
  Typography,
} from '@material-ui/core';
import { Skeleton } from '@openchoreo/backstage-design-system';
import {
  VirtualizedLogList,
  useAutoLoadWhenEmpty,
} from '@openchoreo/backstage-plugin-react';
import { useFillPageHeight } from '../../hooks/useFillPageHeight';
import { AuditEventRow } from './AuditEventRow';
import { getAuditColumnStyle } from './columns';
import { useAuditTableStyles } from './styles';
import { AUDIT_COLUMNS, AuditLogRecord } from './types';

export interface AuditLogsTableProps {
  records: AuditLogRecord[];
  /** Column ids to show, in the table's canonical order. */
  columns: string[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  selectedEventId?: string;
  onSelect: (eventId: string) => void;
  /** Offered by the empty state, which is where a too-narrow query is noticed. */
  onClearFilters?: () => void;
  hasFilters?: boolean;
}

// Below this the table stops shrinking and the page scrolls instead: a short
// screen still gets a usable number of rows.
const MIN_TABLE_HEIGHT = 320;
const FALLBACK_TABLE_HEIGHT = 'calc(100vh - 320px)';
const ROW_HEIGHT_ESTIMATE = 46;
const SKELETON_ROWS = 8;

const COLUMN_LABELS = new Map(AUDIT_COLUMNS.map(c => [c.id, c.label]));

/**
 * The trail as a virtualized table: only the rows in view are mounted, so a
 * page of records costs the same to render as a screenful.
 */
export const AuditLogsTable = ({
  records,
  columns,
  loading,
  hasMore,
  onLoadMore,
  selectedEventId,
  onSelect,
  onClearFilters,
  hasFilters = false,
}: AuditLogsTableProps) => {
  const classes = useAuditTableStyles();
  const paperRef = useRef<HTMLDivElement>(null);
  const tableHeight = useFillPageHeight(paperRef, {
    minHeight: MIN_TABLE_HEIGHT,
    fallback: FALLBACK_TABLE_HEIGHT,
  });

  // The virtualizer renders no load-more sentinel for an empty list, so the
  // "0 rows but hasMore" case needs its own trigger.
  useAutoLoadWhenEmpty({
    count: records.length,
    hasMore,
    loading,
    onLoadMore,
  });

  // `event_id` is unique per record, so measurements survive appended pages.
  const getRowKey = useCallback(
    (index: number) => records[index].event_id,
    [records],
  );

  const header = useMemo(
    () => (
      <Box className={classes.headerRow} role="row">
        {columns.map(id => (
          <Box
            key={id}
            role="columnheader"
            style={getAuditColumnStyle(id)}
            className={classes.headerColumn}
          >
            {COLUMN_LABELS.get(id) ?? id}
          </Box>
        ))}
        <Box
          role="columnheader"
          style={getAuditColumnStyle('actions')}
          className={classes.headerColumn}
        >
          <span aria-hidden="true" />
        </Box>
      </Box>
    ),
    [classes.headerColumn, classes.headerRow, columns],
  );

  const footer = hasMore ? (
    <div className={classes.loadingContainer}>
      {loading ? (
        <Box display="flex" alignItems="center" role="status" aria-busy="true">
          <CircularProgress size={20} aria-hidden="true" />
          <Typography variant="body2" style={{ marginLeft: 8 }}>
            Loading more records...
          </Typography>
        </Box>
      ) : (
        <Typography variant="body2" color="textSecondary">
          Scroll to load more records
        </Typography>
      )}
    </div>
  ) : null;

  const renderRow = useCallback(
    (index: number) => (
      <AuditEventRow
        record={records[index]}
        columns={columns}
        selected={records[index].event_id === selectedEventId}
        onSelect={onSelect}
      />
    ),
    [columns, onSelect, records, selectedEventId],
  );

  return (
    // `grid` rather than `table`: the rows are selectable, and `aria-selected`
    // is only meaningful on a row inside a grid.
    <Paper
      ref={paperRef}
      className={classes.tablePaper}
      role="grid"
      aria-label="Audit logs"
    >
      {records.length === 0 ? (
        <>
          {header}
          {loading ? (
            Array.from({ length: SKELETON_ROWS }).map((_, index) => (
              <Box
                key={`skeleton-${index}`}
                className={classes.skeletonRow}
                data-testid="audit-row-skeleton"
              >
                {columns.map(id => (
                  <Box
                    key={id}
                    style={getAuditColumnStyle(id)}
                    className={classes.cell}
                  >
                    <Skeleton variant="text" width="100%" />
                  </Box>
                ))}
              </Box>
            ))
          ) : (
            <Box className={classes.emptyState}>
              <Typography variant="h6" gutterBottom>
                No records match this query
              </Typography>
              <Typography variant="body2">
                {hasFilters
                  ? 'Filters on different fields stack as AND, so they narrow fast. Drop one, or widen the time range.'
                  : 'Nothing was recorded in this window. Try a wider time range.'}
              </Typography>
              {hasFilters && onClearFilters && (
                <Box marginTop={2}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={onClearFilters}
                  >
                    Clear all filters
                  </Button>
                </Box>
              )}
            </Box>
          )}
        </>
      ) : (
        <VirtualizedLogList
          itemCount={records.length}
          maxHeight={tableHeight}
          estimatedRowHeight={ROW_HEIGHT_ESTIMATE}
          getItemKey={getRowKey}
          hasMore={hasMore}
          loading={loading}
          onReachEnd={onLoadMore}
          header={header}
          footer={footer}
          renderRow={renderRow}
        />
      )}
    </Paper>
  );
};
