import { FC, useState, Fragment } from 'react';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Paper,
  IconButton,
  Tooltip,
  Box,
  Typography,
  CircularProgress,
} from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import { WaterfallView } from './WaterfallView';
import { useTracesTableStyles } from './styles';
import { Trace, Span, SpanDetails } from '../../types';
import { formatDuration } from './utils';

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

export const TracesTable: FC<TracesTableProps> = ({
  traces,
  traceSpans,
  spanDetails,
  loading = false,
}) => {
  const classes = useTracesTableStyles();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRowExpansion = (traceId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(traceId)) {
      newExpanded.delete(traceId);
    } else {
      newExpanded.add(traceId);
      // Trigger on-demand span fetch when expanding
      traceSpans.fetchSpans(traceId);
    }
    setExpandedRows(newExpanded);
  };

  const renderEmptyState = () => {
    if (loading) {
      return null;
    }

    return (
      <TableRow>
        <TableCell colSpan={6}>
          <Box className={classes.emptyState}>
            <Typography variant="h6" gutterBottom>
              No traces found
            </Typography>
            <Typography variant="body2">
              Try adjusting your filters or time range to see more traces.
            </Typography>
          </Box>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <Paper className={classes.tablePaper}>
      <Box className={classes.tableContainer}>
        <Table className={classes.table} aria-label="traces table" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell className={classes.headerCell} width="12%">
                Trace Name
              </TableCell>
              <TableCell className={classes.headerCell} width="20%">
                Start Time
              </TableCell>
              <TableCell className={classes.headerCell} width="20%">
                End Time
              </TableCell>
              <TableCell className={classes.headerCell} width="12%">
                Duration
              </TableCell>
              <TableCell className={classes.headerCell} width="12%">
                Number of Spans
              </TableCell>
              <TableCell
                className={classes.headerCell}
                width="12%"
                align="right"
              >
                Details
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {traces.length === 0 && !loading && renderEmptyState()}

            {traces.map(trace => {
              const isExpanded = expandedRows.has(trace.traceId);
              const spans = traceSpans.getSpans(trace.traceId);
              const spansLoading = traceSpans.isLoading(trace.traceId);
              const spansError = traceSpans.getError(trace.traceId);

              return (
                <Fragment key={trace.traceId}>
                  <TableRow
                    className={`${classes.traceRow} ${
                      isExpanded ? classes.expandedRow : ''
                    }`}
                    onClick={() => toggleRowExpansion(trace.traceId)}
                  >
                    <TableCell
                      component="th"
                      scope="row"
                      width="12%"
                      className={classes.traceIdCell}
                    >
                      <Tooltip title={trace.traceId}>
                        <span>
                          {trace.traceName || `${trace.traceId.slice(0, 8)}...`}
                        </span>
                      </Tooltip>
                    </TableCell>
                    <TableCell width="20%" className={classes.traceCell}>
                      {trace.startTime}
                    </TableCell>
                    <TableCell width="20%" className={classes.traceCell}>
                      {trace.endTime}
                    </TableCell>
                    <TableCell width="12%" className={classes.traceCell}>
                      {formatDuration(trace.durationNs)}
                    </TableCell>
                    <TableCell width="12%" className={classes.traceCell}>
                      {trace.spanCount}
                    </TableCell>
                    <TableCell width="12%" align="right">
                      <IconButton
                        size="small"
                        onClick={e => {
                          e.stopPropagation();
                          toggleRowExpansion(trace.traceId);
                        }}
                        className={classes.expandIcon}
                      >
                        {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </TableCell>
                  </TableRow>

                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={6} style={{ padding: 0 }}>
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
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </Box>
    </Paper>
  );
};
