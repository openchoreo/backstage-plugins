import { FC, useEffect, useMemo, useState } from 'react';
import {
  TableRow,
  TableCell,
  Chip,
  Collapse,
  Box,
  Typography,
  CircularProgress,
} from '@material-ui/core';
import type { Retry, RetryStatus } from './types';
import { useLogEntryStyles } from '../RuntimeLogs/styles';
import { useTriggersStyles } from './styles';
import { usePodLogs } from '../../hooks/usePodLogs';

interface RetryRowProps {
  retry: Retry;
  namespaceName: string;
  projectName: string;
  environmentName: string;
  componentName: string;
  triggerStartTime?: string;
  triggerCompletionTime?: string;
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
  triggerClasses: ReturnType<typeof useTriggersStyles>,
): string => {
  switch (status) {
    case 'Succeeded':
      return triggerClasses.successChip;
    case 'Failed':
      return logClasses.errorChip;
    case 'Running':
      return triggerClasses.runningChip;
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
  triggerStartTime,
  triggerCompletionTime,
}) => {
  const logClasses = useLogEntryStyles();
  const triggerClasses = useTriggersStyles();
  const [expanded, setExpanded] = useState(false);

  const { logsStartTime, logsEndTime } = useMemo(() => {
    const baseStart = retry.startTime || triggerStartTime;
    const startMs = baseStart
      ? new Date(baseStart).getTime() - 60 * 1000
      : Date.now() - 24 * 3600 * 1000;
    const endMs = triggerCompletionTime
      ? new Date(triggerCompletionTime).getTime() + 5 * 60 * 1000
      : Date.now();
    return {
      logsStartTime: new Date(startMs).toISOString(),
      logsEndTime: new Date(endMs).toISOString(),
    };
  }, [retry.startTime, triggerStartTime, triggerCompletionTime]);

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
        return triggerClasses.logLevelError;
      case 'WARN':
      case 'WARNING':
        return triggerClasses.logLevelWarn;
      case 'INFO':
        return triggerClasses.logLevelInfo;
      case 'DEBUG':
        return triggerClasses.logLevelDebug;
      default:
        return '';
    }
  };

  return (
    <>
      <TableRow
        hover
        className={`${logClasses.logRow} ${expanded ? logClasses.expandedRow : ''}`}
        onClick={() => setExpanded(prev => !prev)}
      >
        <TableCell>
          <Chip
            size="small"
            label={retry.status}
            className={`${logClasses.logLevelChip} ${getStatusChipClass(retry.status, logClasses, triggerClasses)}`}
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
                {retry.events && retry.events.length > 0 && (
                  <>
                    <Typography className={triggerClasses.sectionTitle}>
                      Events
                    </Typography>
                    <Box className={logClasses.metadataBox}>
                      {retry.events.map((event, idx) => (
                        <Box key={idx} className={triggerClasses.eventItem}>
                          <span className={triggerClasses.eventTimestamp}>
                            {formatTimestamp(event.timestamp)}
                          </span>
                          <span
                            className={`${triggerClasses.eventReason} ${event.type === 'Warning' ? triggerClasses.warningEvent : ''}`}
                          >
                            {event.reason}
                          </span>
                          <span className={triggerClasses.eventMessage}>
                            {event.message}
                          </span>
                        </Box>
                      ))}
                    </Box>
                  </>
                )}

                <Typography className={triggerClasses.sectionTitle}>
                  Logs ({logs.length})
                </Typography>

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
                  <Box className={triggerClasses.logsContainer}>
                    {logs.map((log, idx) => (
                      <Box
                        key={`${log.timestamp ?? ''}-${idx}`}
                        className={triggerClasses.logLine}
                      >
                        <span className={triggerClasses.logTimestamp}>
                          {formatTimestamp(log.timestamp)}
                        </span>
                        <span
                          className={`${triggerClasses.logLevel} ${logLevelClass(log.level)}`}
                        >
                          {log.level || '-'}
                        </span>
                        <span className={triggerClasses.logMessage}>
                          {log.log}
                        </span>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};
