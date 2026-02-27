import { useState, useEffect, type FC } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { useApi } from '@backstage/core-plugin-api';
import { openChoreoClientApiRef } from '../../../../api/OpenChoreoClientApi';
import type { ResourceEvent } from '../../../../api/OpenChoreoClientApi';
import type { LayoutNode } from './treeTypes';
import { useTreeStyles } from './treeStyles';

interface ResourceEventsTableProps {
  node: LayoutNode;
  namespaceName: string;
  releaseBindingName: string;
  refreshKey?: number;
}

const useEventStyles = makeStyles(theme => ({
  row: {
    '&:last-child td': {
      borderBottom: 0,
    },
  },
  warningRow: {
    borderLeft: `3px solid ${theme.palette.error.main}`,
  },
  normalRow: {
    borderLeft: `3px solid ${theme.palette.success.main}`,
  },
  tableContainer: {
    maxHeight: '100%',
    overflow: 'auto',
  },
  headerCell: {
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  messageCell: {
    maxWidth: 400,
    wordBreak: 'break-word',
  },
  countCell: {
    textAlign: 'center',
  },
}));

function formatRelativeTime(timestamp: string): string {
  if (!timestamp) return '-';

  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;

  if (isNaN(then)) return timestamp;
  if (diffMs <= 0) return 'just now';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export const ResourceEventsTable: FC<ResourceEventsTableProps> = ({
  node,
  namespaceName,
  releaseBindingName,
  refreshKey,
}) => {
  const treeClasses = useTreeStyles();
  const classes = useEventStyles();
  const client = useApi(openChoreoClientApiRef);

  const [events, setEvents] = useState<ResourceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchEvents = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await client.fetchResourceEvents(
          namespaceName,
          releaseBindingName,
          {
            group: node.group ?? '',
            version: node.version ?? '',
            kind: node.kind,
            name: node.name,
          },
        );

        if (!cancelled) {
          const responseData = (response as any)?.data ?? response;
          const fetched = responseData?.events ?? [];
          // Sort by lastTimestamp descending (newest first)
          fetched.sort(
            (a: ResourceEvent, b: ResourceEvent) =>
              new Date(b.lastTimestamp).getTime() -
              new Date(a.lastTimestamp).getTime(),
          );
          setEvents(fetched);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Failed to fetch events');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchEvents();

    return () => {
      cancelled = true;
    };
  }, [
    client,
    namespaceName,
    releaseBindingName,
    node.kind,
    node.name,
    node.group,
    node.version,
    refreshKey,
  ]);

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

  if (events.length === 0) {
    return (
      <Box className={treeClasses.drawerEmptyState}>
        <Typography variant="body2" color="textSecondary">
          No events available
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer className={classes.tableContainer}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell className={classes.headerCell}>Reason</TableCell>
            <TableCell className={classes.headerCell}>Message</TableCell>
            <TableCell className={classes.headerCell}>Count</TableCell>
            <TableCell className={classes.headerCell}>First Seen</TableCell>
            <TableCell className={classes.headerCell}>Last Seen</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {events.map((event, index) => (
            <TableRow
              key={`${event.reason}-${event.lastTimestamp}-${index}`}
              className={`${classes.row} ${
                event.type === 'Warning'
                  ? classes.warningRow
                  : classes.normalRow
              }`}
            >
              <TableCell>{event.reason}</TableCell>
              <TableCell className={classes.messageCell}>
                {event.message}
              </TableCell>
              <TableCell className={classes.countCell}>
                {event.count ?? '-'}
              </TableCell>
              <TableCell>{formatRelativeTime(event.firstTimestamp)}</TableCell>
              <TableCell>{formatRelativeTime(event.lastTimestamp)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
