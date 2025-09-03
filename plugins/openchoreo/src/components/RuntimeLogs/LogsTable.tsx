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
import { makeStyles } from '@material-ui/core/styles';
import { LogEntry as LogEntryType } from './types';
import { LogEntry } from './LogEntry';
import { PageBanner } from '../CommonComponents';
import InfoRounded from '@material-ui/icons/InfoRounded';

const useStyles = makeStyles(theme => ({
  tableContainer: {
    height: 'calc(100vh - 380px)',
    overflow: 'auto',
  },
  table: {
    minWidth: 650,
  },
  headerCell: {
    fontWeight: 'bold',
    backgroundColor: theme.palette.background.paper,
    position: 'sticky',
    top: 0,
    zIndex: 1,
  },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing(4),
    color: theme.palette.text.secondary,
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing(2),
  },
  loadingRow: {
    padding: theme.spacing(2),
  },
  skeletonRow: {
    height: 60,
  },
  emptyStateCell: {
    backgroundColor: 'transparent !important',
  },
}));

interface LogsTableProps {
  logs: LogEntryType[];
  loading: boolean;
  hasMore: boolean;
  totalCount: number;
  loadingRef: RefObject<HTMLDivElement>;
  onRetry?: () => void;
}

export const LogsTable: FC<LogsTableProps> = ({
  logs,
  loading,
  hasMore,
  totalCount,
  loadingRef,
}) => {
  const classes = useStyles();

  const renderLoadingSkeletons = () => {
    return Array.from({ length: 5 }).map((_, index) => (
      <TableRow key={`skeleton-${index}`}>
        <TableCell>
          <Skeleton variant="text" width="100%" />
        </TableCell>
        <TableCell>
          <Skeleton variant="text" width="100%" />
        </TableCell>
        <TableCell>
          <Skeleton variant="text" width={80} />
        </TableCell>
        <TableCell>
          <Skeleton variant="text" width={100} />
        </TableCell>
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
      <TableRow className={classes.emptyStateCell}>
        <TableCell colSpan={5} className={classes.emptyStateCell}>
          <Box display="flex" justifyContent="center" alignItems="center" height="100%" pt={10}>
          <PageBanner
            title="No logs found"
            description="Try adjusting your filters or time range."
            icon={<InfoRounded fontSize='large' />}
          />
          </Box>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <Paper>
      <Box className={classes.tableContainer}>
        <Table className={classes.table} stickyHeader size='small'>
          <TableHead>
            <TableRow>
              <TableCell className={classes.headerCell}>Timestamp</TableCell>
              <TableCell className={classes.headerCell}>Container</TableCell>
              <TableCell className={classes.headerCell}>Pod</TableCell>
              <TableCell className={classes.headerCell}>Message</TableCell>
              <TableCell className={classes.headerCell} width={100}>
                Details
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.length === 0 && !loading && renderEmptyState()}

            {logs.length === 0 && loading && renderLoadingSkeletons()}

            {logs.map((log, index) => (
              <LogEntry key={`${log.timestamp}-${index}`} log={log} />
            ))}

            {hasMore && (
              <TableRow>
                <TableCell colSpan={5}>
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

      {logs.length > 0 && (
        <Box
          p={2}
          display="flex"
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography variant="body2" color="textSecondary">
            Showing {logs.length} of {totalCount} logs
          </Typography>

          {!hasMore && logs.length < totalCount && (
            <Typography variant="body2" color="textSecondary">
              Reached end of results
            </Typography>
          )}
        </Box>
      )}
    </Paper>
  );
};
