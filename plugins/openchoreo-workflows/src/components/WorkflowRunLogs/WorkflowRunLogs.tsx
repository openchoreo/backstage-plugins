import { Progress } from '@backstage/core-components';
import { Alert, AlertTitle } from '@material-ui/lab';
import { Box, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import type { LogsResponse } from '../../types';

const useStyles = makeStyles(theme => ({
  logsContainer: {
    backgroundColor: theme.palette.type === 'dark' ? '#1e1e1e' : '#f5f5f5',
    borderRadius: 4,
    padding: theme.spacing(2),
    fontFamily: 'monospace',
    fontSize: '0.875rem',
    maxHeight: '600px',
    overflow: 'auto',
    marginTop: theme.spacing(2),
  },
  logEntry: {
    display: 'flex',
    gap: theme.spacing(2),
    padding: theme.spacing(0.5, 0),
    borderBottom: `1px solid ${theme.palette.divider}`,
    '&:last-child': {
      borderBottom: 'none',
    },
  },
  timestamp: {
    color: theme.palette.text.secondary,
    whiteSpace: 'nowrap',
    minWidth: 180,
    flexShrink: 0,
  },
  message: {
    flex: 1,
    wordBreak: 'break-word',
    whiteSpace: 'pre-wrap',
  },
  emptyState: {
    padding: theme.spacing(4),
    textAlign: 'center',
    color: theme.palette.text.secondary,
  },
  logsInfo: {
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1),
    fontSize: '0.875rem',
  },
}));

interface WorkflowRunLogsProps {
  logs: LogsResponse | null;
  loading: boolean;
  error: Error | null;
}

export const WorkflowRunLogs = ({ logs, loading, error }: WorkflowRunLogsProps) => {
  const classes = useStyles();

  if (loading) {
    return <Progress />;
  }

  if (error) {
    return (
      <Alert severity="error">
        <AlertTitle>Error loading logs</AlertTitle>
        {error.message}
      </Alert>
    );
  }

  // Handle observability not configured
  if (logs?.error === 'OBSERVABILITY_NOT_CONFIGURED') {
    return (
      <Alert severity="info">
        <AlertTitle>Logs not available</AlertTitle>
        {logs.message || 'Observability is not configured for this workflow run. Logs cannot be retrieved.'}
      </Alert>
    );
  }

  if (!logs || logs.logs.length === 0) {
    return (
      <Box className={classes.emptyState}>
        <Typography variant="body1">No logs available for this run.</Typography>
        <Typography variant="body2" color="textSecondary">
          Logs may appear once the workflow starts executing.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography className={classes.logsInfo}>
        {logs.totalCount} log entries
        {logs.tookMs !== undefined && ` (fetched in ${logs.tookMs}ms)`}
      </Typography>
      <Box className={classes.logsContainer}>
        {logs.logs.map((entry, index) => (
          <Box key={index} className={classes.logEntry}>
            <span className={classes.timestamp}>
              {new Date(entry.timestamp).toLocaleString()}
            </span>
            <span className={classes.message}>{entry.log}</span>
          </Box>
        ))}
      </Box>
    </Box>
  );
};
