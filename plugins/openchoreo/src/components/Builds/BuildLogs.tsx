import { useState, useCallback } from 'react';
import {
  Drawer,
  Typography,
  IconButton,
  Box,
  Divider,
  CircularProgress,
} from '@material-ui/core';
import { makeStyles, useTheme } from '@material-ui/core/styles';
import Close from '@material-ui/icons/Close';
import {
  useApi,
  discoveryApiRef,
  identityApiRef,
} from '@backstage/core-plugin-api';
import type { ModelsBuild, LogEntry } from '@openchoreo/backstage-plugin-api';
import { fetchBuildLogsForBuild } from '../../api/buildLogs';
import { PageBanner } from '../CommonComponents';
import { useTimerEffect } from '../../hooks/timerEffect';
import { BuildStatus } from '../CommonComponents/BuildStatus';

const useStyles = makeStyles(theme => ({
  logsContainer: {
    backgroundColor: theme.palette.background.default,
    fontSize: '12px',
    height: 'calc(100vh - 250px)',
    overflow: 'auto',
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    whiteSpace: 'pre-wrap',

  },
  timestampText: {
    fontSize: '11px',
    color: theme.palette.text.secondary,
  },
  logLine: {
    fontSize: '12px',
    color: theme.palette.text.primary,
    fontFamily: 'monospace',
    padding: theme.spacing(0.5, 1),
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
  },
  logText: {
    fontSize: '12px',
    color: theme.palette.text.primary,
    fontFamily: 'monospace',
  },
}));

interface BuildLogsProps {
  open: boolean;
  onClose: () => void;
  build: ModelsBuild | null;
  enableAutoRefresh?: boolean;
}


export const BuildDetails = ({ build }: { build: ModelsBuild }) => {
  const theme = useTheme();
  return (
    <Box display="flex" 
    justifyContent="space-between" 
    flexDirection="row" 
    sx={{
      borderRadius: theme.shape.borderRadius,
    }}>
      <Box>
        <Typography variant="body1">
          Build Name: {build.name}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Commit: {build.commit?.slice(0, 8) || 'N/A'}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          CreatedAt: {new Date(build.createdAt).toLocaleString()}
        </Typography>
      </Box>
      <Box>
        <BuildStatus build={build} />
      </Box>
    </Box>
  );
};

export const BuildLogs = ({ open, onClose, build, enableAutoRefresh = false }: BuildLogsProps) => {
  const classes = useStyles();
  const discoveryApi = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useTimerEffect(() => {
    const fetchBuildLogs = async (selectedBuild: ModelsBuild) => {
      setLoading(true);
      setError(null);

      try {
        const logsData = await fetchBuildLogsForBuild(
          discoveryApi,
          identityApi,
          selectedBuild,
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

    if (open && build) {
      fetchBuildLogs(build);
    }
  }, enableAutoRefresh ? 5000 : 0, [discoveryApi, identityApi, open, build]);

  const renderLogsContent = useCallback(() => {
    if (loading && !logs.length) {
      return (
        <PageBanner
          icon={<CircularProgress size={24} />}
          title="Loading logs..."
          description="Please wait while we fetch the logs"
        />
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
        <PageBanner
          title="No logs found for this build"
          description="Please select a different build to view logs"
        />
      );
    }

    return logs.map((logEntry, index) => (
      <Box key={index} py={0.25} className={classes.logLine}>
        <Typography variant="body2" component="span" className={classes.timestampText}>
          [{new Date(logEntry.timestamp).toLocaleTimeString()}] &nbsp;
        </Typography>
        <Typography variant="body2" component="span" className={classes.logText} >
          {logEntry.log}
        </Typography>
      </Box>
    ));
  }, [loading, logs, error, classes]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        style: {
          width: '600px',
          maxWidth: '80vw',
        },
      }}
    >
      <Box p={2}>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Typography variant="h6">
            Build Details
          </Typography>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>

        <Divider />

        <Box mt={2}>
          {build ? (
            <Box>
              <BuildDetails build={build} />
              <Box mt={2}>
                <Typography variant="subtitle2" gutterBottom>
                  Build Logs
                </Typography>
                <Box py={2} className={classes.logsContainer}>
                  {renderLogsContent()}
                </Box>
              </Box>
            </Box>
          ) : (
            <PageBanner
              title="No build selected"
              description="Please select a build to view logs"
            />
          )}
        </Box>
      </Box>
    </Drawer>
  );
};
