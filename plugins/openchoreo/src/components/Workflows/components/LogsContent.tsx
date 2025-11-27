import { useState, useEffect } from 'react';
import { Typography, Box, CircularProgress } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import {
  useApi,
  discoveryApiRef,
  identityApiRef,
} from '@backstage/core-plugin-api';
import type {
  ModelsBuild,
  LogEntry,
} from '@openchoreo/backstage-plugin-common';
import { fetchBuildLogsForBuild } from '../../../api/buildLogs';

const useStyles = makeStyles(theme => ({
  logsContainer: {
    backgroundColor: theme.palette.background.default,
    fontFamily: 'monospace',
    fontSize: '12px',
    height: 'calc(100vh - 400px)',
    minHeight: '300px',
    overflow: 'auto',
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    whiteSpace: 'pre-wrap',
    padding: theme.spacing(2),
  },
  timestampText: {
    fontSize: '11px',
    color: theme.palette.text.secondary,
  },
  logText: {
    fontSize: '12px',
    color: theme.palette.text.primary,
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '200px',
    gap: theme.spacing(1),
  },
}));

interface LogsContentProps {
  build: ModelsBuild;
}

export const LogsContent = ({ build }: LogsContentProps) => {
  const classes = useStyles();
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      setError(null);
      setLogs([]);

      try {
        const logsData = await fetchBuildLogsForBuild(
          discoveryApi,
          identityApi,
          build,
        );
        setLogs(logsData.logs || []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to fetch build logs',
        );
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [discoveryApi, identityApi, build]);

  if (loading) {
    return (
      <Box className={classes.loadingContainer}>
        <CircularProgress size={24} />
        <Typography variant="body2" color="textSecondary">
          Loading logs...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Typography variant="body2" color="error">
        Error: {error}
      </Typography>
    );
  }

  if (logs.length === 0) {
    return (
      <Typography variant="body2" color="textSecondary">
        No logs available for this build
      </Typography>
    );
  }

  return (
    <Box className={classes.logsContainer}>
      {logs.map((logEntry, index) => (
        <Box key={index} style={{ marginBottom: '4px' }}>
          <Typography variant="body2" className={classes.timestampText}>
            [
            {logEntry.timestamp
              ? new Date(logEntry.timestamp).toLocaleTimeString()
              : 'N/A'}
            ]
          </Typography>
          <Typography variant="body2" className={classes.logText}>
            {logEntry.log}
          </Typography>
        </Box>
      ))}
    </Box>
  );
};
