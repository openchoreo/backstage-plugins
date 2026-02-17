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
  environmentName?: string;
  projectName?: string;
  componentName?: string;
}

export const LogsTable: FC<LogsTableProps> = ({
  selectedFields,
  logs,
  loading,
  hasMore,
  loadingRef,
  environmentName,
  projectName,
  componentName,
}) => {
  const classes = useLogsTableStyles();

  const totalColumns = selectedFields.length;
  const renderLoadingSkeletons = () => {
    return Array.from({ length: 5 }).map((_, index) => (
      <TableRow key={`skeleton-${index}`}>
        {selectedFields.includes(LogEntryField.Timestamp) && (
          <TableCell width="15%">
            <Skeleton variant="text" width="100%" />
          </TableCell>
        )}
        {selectedFields.includes(LogEntryField.LogLevel) && (
          <TableCell width="10%">
            <Skeleton variant="text" width="100%" />
          </TableCell>
        )}
        {selectedFields.includes(LogEntryField.Log) && (
          <TableCell>
            <Skeleton variant="text" width="100%" />
          </TableCell>
        )}
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
              {selectedFields.map(field => {
                let width: string | undefined;

                if (field === LogEntryField.Timestamp) {
                  width = '15%';
                } else if (field === LogEntryField.LogLevel) {
                  width = '10%';
                } else {
                  width = '75%';
                }

                return (
                  <TableCell
                    key={field}
                    className={classes.headerCell}
                    width={width}
                  >
                    {field}
                  </TableCell>
                );
              })}
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
                environmentName={environmentName}
                projectName={projectName}
                componentName={componentName}
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
