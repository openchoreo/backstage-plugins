import { useState, useEffect } from 'react';
import { Typography, Box, CircularProgress } from '@material-ui/core';
import { useApi } from '@backstage/core-plugin-api';
import { Alert } from '@material-ui/lab';
import type {
  ModelsBuild,
  LogEntry,
} from '@openchoreo/backstage-plugin-common';
import { openChoreoCiClientApiRef } from '../../api/OpenChoreoCiClientApi';
import { useStyles } from './styles';

interface LogsContentProps {
  build: ModelsBuild;
}

export const LogsContent = ({ build }: LogsContentProps) => {
  const classes = useStyles();
  const client = useApi(openChoreoCiClientApiRef);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isObservabilityNotConfigured, setIsObservabilityNotConfigured] =
    useState(false);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      setError(null);
      setIsObservabilityNotConfigured(false);
      setLogs([]);

      try {
        const logsData = await client.fetchBuildLogsForBuild(build);
        setLogs(logsData.logs || []);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to fetch build logs';

        // Check if the error is due to observability not being configured
        if (errorMessage.includes('ObservabilityNotConfigured')) {
          setIsObservabilityNotConfigured(true);
          // Extract the actual message from the error response
          try {
            const match = errorMessage.match(/"message"\s*:\s*"([^"]+)"/);
            setError(
              match
                ? match[1]
                : 'Observability is not enabled for this component. Please enable observability to view build logs.',
            );
          } catch {
            setError(
              'Observability is not enabled for this component. Please enable observability to view build logs.',
            );
          }
        } else {
          setError(errorMessage);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [client, build]);

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
    // Show info alert for observability not configured (matching observability plugin style)
    if (isObservabilityNotConfigured) {
      return (
        <Alert severity="info">
          <Typography variant="body1">{error}</Typography>
        </Alert>
      );
    }

    // Show error alert for other errors
    return (
      <Alert severity="error">
        <Typography variant="body1">{error}</Typography>
      </Alert>
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
