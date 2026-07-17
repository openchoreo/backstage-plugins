import { FC, MouseEvent, useEffect, useMemo, useState } from 'react';
import {
  TableRow,
  TableCell,
  Chip,
  Collapse,
  Box,
  Typography,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@material-ui/core';
import ExpandMore from '@material-ui/icons/ExpandMore';
import ChevronRight from '@material-ui/icons/ChevronRight';
import Refresh from '@material-ui/icons/Refresh';
import type { Retry, RetryStatus } from './types';
import { useLogEntryStyles } from '../RuntimeLogs/styles';
import { useRunsStyles } from './styles';
import { usePodLogs } from '../../hooks/usePodLogs';

interface RetryRowProps {
  retry: Retry;
  namespaceName: string;
  projectName: string;
  environmentName: string;
  componentName: string;
  runStartTime?: string;
  runCompletionTime?: string;
}

const formatTimestamp = (ts?: string) => {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
};

const getStatusChipClass = (
  status: RetryStatus,
  logClasses: ReturnType<typeof useLogEntryStyles>,
  runClasses: ReturnType<typeof useRunsStyles>,
): string => {
  switch (status) {
    case 'Succeeded':
      return runClasses.successChip;
    case 'Failed':
      return logClasses.errorChip;
    case 'Running':
      return runClasses.runningChip;
    default:
      return logClasses.undefinedChip;
  }
};

export const RetryRow: FC<RetryRowProps> = ({
  retry,
  namespaceName,
  projectName,
  environmentName,
  componentName,
  runStartTime,
  runCompletionTime,
}) => {
  const logClasses = useLogEntryStyles();
  const runClasses = useRunsStyles();
  const [expanded, setExpanded] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(true);

  const { logsStartTime, logsEndTime } = useMemo(() => {
    const baseStart = retry.startTime || runStartTime;
    const startMs = baseStart
      ? new Date(baseStart).getTime() - 60 * 1000
      : Date.now() - 24 * 3600 * 1000;
    const endMs = runCompletionTime
      ? new Date(runCompletionTime).getTime() + 5 * 60 * 1000
      : Date.now();
    return {
      logsStartTime: new Date(startMs).toISOString(),
      logsEndTime: new Date(endMs).toISOString(),
    };
  }, [retry.startTime, runStartTime, runCompletionTime]);

  const {
    logs,
    loading: logsLoading,
    error: logsError,
    fetchLogs,
  } = usePodLogs({
    podName: expanded ? retry.podName : '',
    namespaceName,
    projectName,
    environmentName,
    componentName,
    startTime: logsStartTime,
    endTime: logsEndTime,
  });

  useEffect(() => {
    if (expanded) {
      fetchLogs();
    }
  }, [expanded, fetchLogs]);

  const logLevelClass = (level?: string): string => {
    switch ((level || '').toUpperCase()) {
      case 'ERROR':
        return runClasses.logLevelError;
      case 'WARN':
      case 'WARNING':
        return runClasses.logLevelWarn;
      case 'INFO':
        return runClasses.logLevelInfo;
      case 'DEBUG':
        return runClasses.logLevelDebug;
      default:
        return '';
    }
  };

  return (
    <>
      <TableRow
        hover
        className={`${logClasses.logRow} ${
          expanded ? logClasses.expandedRow : ''
        }`}
        onClick={() => setExpanded(prev => !prev)}
      >
        <TableCell>
          <Chip
            size="small"
            label={retry.status}
            className={`${logClasses.logLevelChip} ${getStatusChipClass(
              retry.status,
              logClasses,
              runClasses,
            )}`}
          />
        </TableCell>
        <TableCell className={logClasses.monospaceCell}>
          {retry.podName}
        </TableCell>
        <TableCell style={{ fontSize: '0.75rem' }}>
          {formatTimestamp(retry.startTime)}
        </TableCell>
        <TableCell style={{ fontSize: '0.75rem' }}>
          {retry.eventCount}
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow>
          <TableCell colSpan={4} style={{ paddingBottom: 0, paddingTop: 0 }}>
            <Collapse in={expanded} timeout="auto" unmountOnExit>
              <Box className={logClasses.expandedContent}>
                <Box
                  className={runClasses.sectionHeader}
                  onClick={() => setLogsOpen(prev => !prev)}
                >
                  {logsOpen ? (
                    <ExpandMore className={runClasses.sectionToggleIcon} />
                  ) : (
                    <ChevronRight className={runClasses.sectionToggleIcon} />
                  )}
                  <Typography className={runClasses.sectionHeaderTitle}>
                    Logs ({logs.length})
                  </Typography>
                  <Tooltip title="Refresh logs">
                    <IconButton
                      size="small"
                      className={runClasses.sectionRefreshButton}
                      disabled={logsLoading}
                      onClick={(e: MouseEvent) => {
                        e.stopPropagation();
                        if (!logsOpen) setLogsOpen(true);
                        fetchLogs();
                      }}
                    >
                      <Refresh className={runClasses.sectionRefreshIcon} />
                    </IconButton>
                  </Tooltip>
                </Box>

                <Collapse in={logsOpen} timeout="auto" unmountOnExit>
                  {logsLoading && (
                    <Box display="flex" justifyContent="center" p={1}>
                      <CircularProgress size={16} />
                    </Box>
                  )}

                  {logsError && (
                    <Typography variant="body2" color="error">
                      {logsError}
                    </Typography>
                  )}

                  {!logsLoading && !logsError && logs.length === 0 && (
                    <Typography
                      variant="body2"
                      color="textSecondary"
                      style={{ padding: 8 }}
                    >
                      No logs found for this pod.
                    </Typography>
                  )}

                  {!logsLoading && !logsError && logs.length > 0 && (
                    <Box className={runClasses.logsContainer}>
                      {logs.map((log, idx) => (
                        <Box
                          key={`${log.timestamp ?? ''}-${idx}`}
                          className={runClasses.logLine}
                        >
                          <span className={runClasses.logTimestamp}>
                            {formatTimestamp(log.timestamp)}
                          </span>
                          <span
                            className={`${runClasses.logLevel} ${logLevelClass(
                              log.level,
                            )}`}
                          >
                            {log.level || '-'}
                          </span>
                          <span className={runClasses.logMessage}>
                            {log.log}
                          </span>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Collapse>

                {retry.events && retry.events.length > 0 && (
                  <>
                    <Box
                      className={runClasses.sectionHeader}
                      onClick={() => setEventsOpen(prev => !prev)}
                    >
                      {eventsOpen ? (
                        <ExpandMore className={runClasses.sectionToggleIcon} />
                      ) : (
                        <ChevronRight
                          className={runClasses.sectionToggleIcon}
                        />
                      )}
                      <Typography className={runClasses.sectionHeaderTitle}>
                        Events ({retry.events.length})
                      </Typography>
                    </Box>
                    <Collapse in={eventsOpen} timeout="auto" unmountOnExit>
                      <Box className={logClasses.metadataBox}>
                        {retry.events.map((event, idx) => (
                          <Box key={idx} className={runClasses.eventItem}>
                            <span className={runClasses.eventTimestamp}>
                              {formatTimestamp(event.timestamp)}
                            </span>
                            <span
                              className={`${runClasses.eventReason} ${
                                event.type === 'Warning'
                                  ? runClasses.warningEvent
                                  : ''
                              }`}
                            >
                              {event.reason}
                            </span>
                            <span className={runClasses.eventMessage}>
                              {event.message}
                            </span>
                          </Box>
                        ))}
                      </Box>
                    </Collapse>
                  </>
                )}
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};
