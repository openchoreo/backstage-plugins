import { RefObject, FC } from 'react';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Paper,
  Box,
  Typography,
  CircularProgress,
} from '@material-ui/core';
import { Skeleton } from '@material-ui/lab';
import { LogEntryField, LogEntry as LogEntryType } from './types';
import { LogEntry } from './LogEntry';
import { useLogsTableStyles } from './styles';

interface LogsTableProps {
  selectedFields: LogEntryField[];
  logs: LogEntryType[];
  loading: boolean;
  hasMore: boolean;
  loadingRef: RefObject<HTMLDivElement>;
}

export const LogsTable: FC<LogsTableProps> = ({
  selectedFields,
  logs,
  loading,
  hasMore,
  loadingRef,
}) => {
  const classes = useLogsTableStyles();

  const getFieldWidth = (field: LogEntryField): string | undefined => {
    switch (field) {
      case LogEntryField.Timestamp:
        return '12%';
      case LogEntryField.LogLevel:
        return '8%';
      case LogEntryField.Container:
        return '8%';
      case LogEntryField.Pod:
        return '10%';
      case LogEntryField.Log:
        return 'auto';
      default:
        return undefined;
    }
  };

  const totalColumns = selectedFields.length + 1; // +1 for Details column

  const renderLoadingSkeletons = () => {
    return Array.from({ length: 5 }).map((_, index) => (
      <TableRow key={`skeleton-${index}`}>
        {selectedFields.map(field => (
          <TableCell key={field}>
            <Skeleton
              variant={field === LogEntryField.LogLevel ? 'rect' : 'text'}
              width={field === LogEntryField.LogLevel ? 60 : '100%'}
              height={field === LogEntryField.LogLevel ? 24 : undefined}
            />
          </TableCell>
        ))}
        <TableCell>
          <Skeleton variant="rect" width={24} height={24} />
        </TableCell>
      </TableRow>
    ));
  };

  const renderEmptyState = () => {
    if (loading) {
      return null;
    }

    return (
      <TableRow>
        <TableCell colSpan={totalColumns}>
          <Box className={classes.emptyState}>
            <Typography variant="h6" gutterBottom>
              No logs found
            </Typography>
            <Typography variant="body2">
              Try adjusting your filters or time range to see more logs.
            </Typography>
          </Box>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <Paper className={classes.tablePaper}>
      <Box className={classes.tableContainer}>
        <Table className={classes.table} stickyHeader>
          <TableHead>
            <TableRow>
              {selectedFields.map(field => (
                <TableCell
                  key={field}
                  className={classes.headerCell}
                  width={getFieldWidth(field)}
                >
                  {field}
                </TableCell>
              ))}
              <TableCell className={classes.headerCell} width="80px">
                Details
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.length === 0 && !loading && renderEmptyState()}

            {logs.length === 0 && loading && renderLoadingSkeletons()}

            {logs.map((log, index) => (
              <LogEntry
                key={`${log.timestamp}-${index}`}
                log={log}
                selectedFields={selectedFields}
              />
            ))}

            {hasMore && (
              <TableRow>
                <TableCell colSpan={totalColumns}>
                  <div className={classes.loadingContainer} ref={loadingRef}>
                    {loading ? (
                      <Box display="flex" alignItems="center">
                        <CircularProgress size={20} />
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
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Box>
    </Paper>
  );
};
