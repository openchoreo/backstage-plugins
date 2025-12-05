import { FC, useState } from 'react';
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
} from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import { WaterfallView, Trace as TraceData } from './WaterfallView';
import { useTracesTableStyles } from './styles';

export interface Trace {
  traceId: string;
  start_time: string;
  end_time: string;
  duration: number;
  number_of_spans: number;
  spans?: TraceData['spans'];
}

interface TracesTableProps {
  traces: Trace[];
  tracesDataMap: Map<string, TraceData>;
  loading?: boolean;
}

export const TracesTable: FC<TracesTableProps> = ({
  traces,
  tracesDataMap,
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
              <TableCell className={classes.headerCell} width="12%">Trace ID</TableCell>
              <TableCell className={classes.headerCell} width="20%">Start Time</TableCell>
              <TableCell className={classes.headerCell} width="20%">End Time</TableCell>
              <TableCell className={classes.headerCell} width="12%">Duration (ns)</TableCell>
              <TableCell className={classes.headerCell} width="12%">Number of Spans</TableCell>
              <TableCell className={classes.headerCell} width="12%" align="right">
                Details
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {traces.length === 0 && !loading && renderEmptyState()}

            {traces.map((trace) => {
              const traceData = tracesDataMap.get(trace.traceId);
              const isExpanded = expandedRows.has(trace.traceId);
              return (
                <>
                  <TableRow
                    key={trace.traceId}
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
                        <span>{trace.traceId.slice(0, 8)}...</span>
                      </Tooltip>
                    </TableCell>
                    <TableCell width="20%" className={classes.traceCell}>
                      {trace.start_time}
                    </TableCell>
                    <TableCell width="20%" className={classes.traceCell}>
                      {trace.end_time}
                    </TableCell>
                    <TableCell width="12%" className={classes.traceCell}>
                      {trace.duration}
                    </TableCell>
                    <TableCell width="12%" className={classes.traceCell}>
                      {trace.number_of_spans}
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
                  {isExpanded && traceData && (
                    <TableRow>
                      <TableCell colSpan={6} style={{ padding: 0 }}>
                        <WaterfallView trace={traceData} />
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
      </Box>
    </Paper>
  );
};
