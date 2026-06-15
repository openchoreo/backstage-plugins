import { FC } from 'react';
import {
  Paper,
  IconButton,
  Tooltip,
  Box,
  Typography,
  CircularProgress,
} from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import {
  VirtualizedLogList,
  useRowExpansion,
} from '@openchoreo/backstage-plugin-react';
import { WaterfallView } from './WaterfallView';
import { useTracesTableStyles } from './styles';
import { Trace, Span, SpanDetails } from '../../types';
import { formatDuration } from './utils';
import { getColumnStyle, TracesColumn } from './columns';

interface TraceSpansHook {
  fetchSpans: (traceId: string) => Promise<void>;
  getSpans: (traceId: string) => Span[] | undefined;
  isLoading: (traceId: string) => boolean;
  getError: (traceId: string) => string | undefined;
}

interface SpanDetailsHook {
  fetchSpanDetails: (traceId: string, spanId: string) => Promise<void>;
  getDetails: (traceId: string, spanId: string) => SpanDetails | undefined;
  isLoading: (traceId: string, spanId: string) => boolean;
  getError: (traceId: string, spanId: string) => string | undefined;
}

interface TracesTableProps {
  traces: Trace[];
  traceSpans: TraceSpansHook;
  spanDetails: SpanDetailsHook;
  loading?: boolean;
}

// Matches the height the table scroll area used to have.
const TRACES_HEIGHT = 'calc(100vh - 320px)';

const HEADER_COLUMNS: {
  key: TracesColumn;
  label: string;
  align?: 'right';
}[] = [
  { key: 'traceName', label: 'Trace Name' },
  { key: 'startTime', label: 'Start Time' },
  { key: 'endTime', label: 'End Time' },
  { key: 'duration', label: 'Duration' },
  { key: 'spanCount', label: 'Number of Spans' },
  { key: 'details', label: 'Details', align: 'right' },
];

export const TracesTable: FC<TracesTableProps> = ({
  traces,
  traceSpans,
  spanDetails,
  loading = false,
}) => {
  const classes = useTracesTableStyles();

  // Expanded rows are tracked here (not inside per-row state) so the state
  // survives the virtualizer unmounting rows that scroll off-screen.
  const { expanded, toggle } = useRowExpansion();

  const handleToggle = (rowKey: string, traceId: string) => {
    // Kick off the on-demand span fetch the first time a row is opened.
    // Gated on a non-empty traceId — an empty id means the row was given a
    // synthetic key for stability and the backend can't actually resolve
    // spans for it.
    if (!expanded.has(rowKey) && traceId) {
      traceSpans.fetchSpans(traceId);
    }
    toggle(rowKey);
  };

  const header = (
    <Box className={classes.headerRow} role="row">
      {HEADER_COLUMNS.map(col => (
        <Box
          key={col.key}
          role="columnheader"
          style={{
            ...getColumnStyle(col.key),
            textAlign: col.align,
          }}
          className={classes.headerColumn}
        >
          {col.label}
        </Box>
      ))}
    </Box>
  );

  const renderEmptyState = () => (
    <Box className={classes.emptyState}>
      <Typography variant="h6" gutterBottom>
        No traces found
      </Typography>
      <Typography variant="body2">
        Try adjusting your filters or time range to see more traces.
      </Typography>
    </Box>
  );

  // Synthetic key fallback for traces with a missing/empty traceId so
  // multiple ID-less rows don't collide on '' inside the virtualizer or the
  // expansion Set (observed for sampled-out / partial-span traces).
  const getRowKey = (index: number) =>
    traces[index].traceId || `__noid-${index}`;

  const renderTraceRow = (index: number) => {
    const trace = traces[index];
    const rowKey = getRowKey(index);
    const isRowExpanded = expanded.has(rowKey);
    const spans = traceSpans.getSpans(trace.traceId);
    const spansLoading = traceSpans.isLoading(trace.traceId);
    const spansError = traceSpans.getError(trace.traceId);

    return (
      <Box
        className={`${classes.traceRow} ${
          isRowExpanded ? classes.expandedRow : ''
        } ${trace.hasErrors ? classes.errorRow : ''}`}
        onClick={() => handleToggle(rowKey, trace.traceId)}
        role="row"
      >
        <Box className={classes.traceRowMain}>
          <Box
            style={getColumnStyle('traceName')}
            className={`${classes.cell} ${classes.traceIdCell}`}
          >
            {trace.hasErrors && (
              <Tooltip title="This trace contains errors" arrow>
                <span className={classes.errorStripe} role="presentation" />
              </Tooltip>
            )}
            <Tooltip title={trace.traceId}>
              <span>
                {trace.traceName || `${trace.traceId.slice(0, 8)}...`}
              </span>
            </Tooltip>
          </Box>
          <Box
            style={getColumnStyle('startTime')}
            className={`${classes.cell} ${classes.traceCell}`}
          >
            {trace.startTime}
          </Box>
          <Box
            style={getColumnStyle('endTime')}
            className={`${classes.cell} ${classes.traceCell}`}
          >
            {trace.endTime}
          </Box>
          <Box
            style={getColumnStyle('duration')}
            className={`${classes.cell} ${classes.traceCell}`}
          >
            {formatDuration(trace.durationNs)}
          </Box>
          <Box
            style={getColumnStyle('spanCount')}
            className={`${classes.cell} ${classes.traceCell}`}
          >
            {trace.spanCount}
          </Box>
          <Box
            style={{ ...getColumnStyle('details'), textAlign: 'right' }}
            className={classes.cell}
          >
            <IconButton
              size="small"
              onClick={e => {
                e.stopPropagation();
                handleToggle(rowKey, trace.traceId);
              }}
              className={classes.expandIcon}
            >
              {isRowExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
        </Box>

        {isRowExpanded && (
          // Stop clicks inside the expanded waterfall from bubbling to the
          // outer row onClick (which would collapse the row the user is
          // trying to inspect).
          <div onClick={e => e.stopPropagation()} role="presentation">
            {spansLoading && (
              <Box
                display="flex"
                justifyContent="center"
                alignItems="center"
                p={2}
              >
                <CircularProgress size={24} />
              </Box>
            )}
            {spansError && (
              <Box p={2}>
                <Typography variant="body2" color="error">
                  Failed to load spans: {spansError}
                </Typography>
              </Box>
            )}
            {!spansLoading && !spansError && spans && (
              <WaterfallView
                traceId={trace.traceId}
                spans={spans}
                spanDetails={spanDetails}
              />
            )}
          </div>
        )}
      </Box>
    );
  };

  return (
    <Paper
      className={classes.tablePaper}
      role="table"
      aria-label="Traces"
    >
      {traces.length === 0 ? (
        <>
          {header}
          {!loading && renderEmptyState()}
        </>
      ) : (
        <VirtualizedLogList
          itemCount={traces.length}
          maxHeight={TRACES_HEIGHT}
          estimatedRowHeight={32}
          // Trace IDs are stable and unique — perfect natural key. Falls back
          // to a per-index synthetic when the backend returns a trace without
          // an id (sampled-out, partial span), so several ID-less rows don't
          // collide on '' inside the virtualizer or the expansion Set.
          getItemKey={getRowKey}
          header={header}
          renderRow={renderTraceRow}
        />
      )}
    </Paper>
  );
};
