import { useState, useEffect, useRef, useMemo, type FC } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { useApi } from '@backstage/core-plugin-api';
import { openChoreoClientApiRef } from '../../../../api/OpenChoreoClientApi';
import type { PodLogEntry } from '../../../../api/OpenChoreoClientApi';
import type { LayoutNode } from './treeTypes';
import { getPodContainerNames } from './podUtils';
import { useTreeStyles } from './treeStyles';

interface ResourcePodLogsViewerProps {
  node: LayoutNode;
  namespaceName: string;
  releaseBindingName: string;
  refreshKey?: number;
}

const ALL_CONTAINERS = 'all';

const useLogStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    gap: theme.spacing(1),
  },
  filterControl: {
    minWidth: 200,
    alignSelf: 'flex-start',
  },
  container: {
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
    backgroundColor: theme.palette.type === 'dark' ? '#1e1e1e' : '#f5f5f5',
    borderRadius: 4,
    padding: theme.spacing(1.5),
  },
  logLine: {
    display: 'flex',
    fontFamily:
      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    fontSize: 12,
    lineHeight: 1.6,
    color: theme.palette.type === 'dark' ? '#d4d4d4' : '#1e1e1e',
  },
  timestamp: {
    flexShrink: 0,
    color: theme.palette.type === 'dark' ? '#6a9955' : '#098658',
    marginRight: theme.spacing(1),
    userSelect: 'none',
  },
  // Fixed-width column (set dynamically in `ch`) so message text lines up
  // regardless of container-name length when viewing all containers.
  containerTag: {
    flexShrink: 0,
    color: theme.palette.type === 'dark' ? '#569cd6' : '#0451a5',
    fontWeight: 600,
    marginRight: theme.spacing(1),
    userSelect: 'none',
    whiteSpace: 'pre',
  },
  message: {
    flex: 1,
    minWidth: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  },
  emptyFilterHint: {
    padding: theme.spacing(1),
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
  const [selectedContainer, setSelectedContainer] =
    useState<string>(ALL_CONTAINERS);

  // Distinct containers that actually produced log lines, in first-seen order —
  // drives per-line labelling and the width of the container column.
  const loggedContainers = useMemo(
    () =>
      Array.from(
        new Set(
          logEntries.map(e => e.container).filter((c): c is string => !!c),
        ),
      ),
    [logEntries],
  );

  // Dropdown options come from the pod spec; fall back to the containers seen in the logs.
  const podContainers = useMemo(
    () => getPodContainerNames(node.specObject),
    [node.specObject],
  );
  const containerOptions =
    podContainers.length > 0 ? podContainers : loggedContainers;

  const containerColumnWidth = useMemo(
    () => loggedContainers.reduce((max, name) => Math.max(max, name.length), 0),
    [loggedContainers],
  );

  const visibleEntries = useMemo(
    () =>
      selectedContainer === ALL_CONTAINERS
        ? logEntries
        : logEntries.filter(e => e.container === selectedContainer),
    [logEntries, selectedContainer],
  );

  // Label each line only when viewing all containers of a multi-container pod.
  const showContainerLabel =
    selectedContainer === ALL_CONTAINERS && loggedContainers.length > 1;

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

  useEffect(() => {
    setSelectedContainer(ALL_CONTAINERS);
  }, [node.name]);

  // Auto-scroll to bottom on load and whenever the visible set changes.
  useEffect(() => {
    if (!loading && visibleEntries.length > 0 && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [loading, visibleEntries.length, selectedContainer]);

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
    <Box className={classes.root}>
      {containerOptions.length > 1 && (
        <FormControl
          variant="outlined"
          size="small"
          className={classes.filterControl}
        >
          <InputLabel id="logs-container-label">Container</InputLabel>
          <Select
            labelId="logs-container-label"
            value={selectedContainer}
            label="Container"
            onChange={e => setSelectedContainer(e.target.value as string)}
          >
            <MenuItem value={ALL_CONTAINERS}>All containers</MenuItem>
            {containerOptions.map(name => (
              <MenuItem key={name} value={name}>
                {name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      <div ref={containerRef} className={classes.container}>
        {visibleEntries.length === 0 ? (
          <Typography
            variant="body2"
            color="textSecondary"
            className={classes.emptyFilterHint}
          >
            No logs for container "{selectedContainer}"
          </Typography>
        ) : (
          visibleEntries.map((entry, index) => (
            <div key={index} className={classes.logLine}>
              <span className={classes.timestamp}>
                {formatLogTimestamp(entry.timestamp)}
              </span>
              {showContainerLabel && (
                <span
                  className={classes.containerTag}
                  style={{ width: `${containerColumnWidth}ch` }}
                >
                  {entry.container ?? ''}
                </span>
              )}
              <span className={classes.message}>{entry.log}</span>
            </div>
          ))
        )}
      </div>
    </Box>
  );
};
