import { useState, useEffect, useRef, type FC } from 'react';
import { Box, Typography, CircularProgress } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { useApi } from '@backstage/core-plugin-api';
import { openChoreoClientApiRef } from '../../../../api/OpenChoreoClientApi';
import type { PodLogEntry } from '../../../../api/OpenChoreoClientApi';
import type { LayoutNode } from './treeTypes';
import { useTreeStyles } from './treeStyles';

interface ResourcePodLogsViewerProps {
  node: LayoutNode;
  namespaceName: string;
  releaseBindingName: string;
  refreshKey?: number;
}

const useLogStyles = makeStyles(theme => ({
  container: {
    maxHeight: '100%',
    overflow: 'auto',
    backgroundColor: theme.palette.type === 'dark' ? '#1e1e1e' : '#f5f5f5',
    borderRadius: 4,
    padding: theme.spacing(1.5),
  },
  logLine: {
    fontFamily:
      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    fontSize: 12,
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    color: theme.palette.type === 'dark' ? '#d4d4d4' : '#1e1e1e',
  },
  timestamp: {
    color: theme.palette.type === 'dark' ? '#6a9955' : '#098658',
    marginRight: theme.spacing(1),
    userSelect: 'none',
  },
}));

function formatLogTimestamp(timestamp: string): string {
  if (!timestamp) return '';
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return timestamp;
  }
}

export const ResourcePodLogsViewer: FC<ResourcePodLogsViewerProps> = ({
  node,
  namespaceName,
  releaseBindingName,
  refreshKey,
}) => {
  const treeClasses = useTreeStyles();
  const classes = useLogStyles();
  const client = useApi(openChoreoClientApiRef);
  const containerRef = useRef<HTMLDivElement>(null);

  const [logEntries, setLogEntries] = useState<PodLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchLogs = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await client.fetchPodLogs(
          namespaceName,
          releaseBindingName,
          {
            podName: node.name,
            sinceSeconds: 3600,
          },
        );

        if (!cancelled) {
          const responseData = (response as any)?.data ?? response;
          setLogEntries(responseData?.logEntries ?? []);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Failed to fetch pod logs');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchLogs();

    return () => {
      cancelled = true;
    };
  }, [client, namespaceName, releaseBindingName, node.name, refreshKey]);

  // Auto-scroll to bottom on initial load
  useEffect(() => {
    if (!loading && logEntries.length > 0 && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [loading, logEntries.length]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" p={4}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box className={treeClasses.drawerEmptyState}>
        <Typography variant="body2" color="error">
          {error}
        </Typography>
      </Box>
    );
  }

  if (logEntries.length === 0) {
    return (
      <Box className={treeClasses.drawerEmptyState}>
        <Typography variant="body2" color="textSecondary">
          No logs available
        </Typography>
      </Box>
    );
  }

  return (
    <div ref={containerRef} className={classes.container}>
      {logEntries.map((entry, index) => (
        <div key={index} className={classes.logLine}>
          <span className={classes.timestamp}>
            {formatLogTimestamp(entry.timestamp)}
          </span>
          {entry.log}
        </div>
      ))}
    </div>
  );
};
