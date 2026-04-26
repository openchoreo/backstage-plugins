import { FC, useState, useEffect } from 'react';
import {
  TableRow,
  TableCell,
  Chip,
  Collapse,
  Box,
  Typography,
  Table,
  TableHead,
  TableBody,
  CircularProgress,
} from '@material-ui/core';
import type { Trigger, TriggerStatus } from './types';
import { useLogEntryStyles } from '../RuntimeLogs/styles';
import { useTriggersStyles } from './styles';
import { useRetries } from '../../hooks/useRetries';
import { RetryRow } from './RetryRow';

interface TriggerRowProps {
  trigger: Trigger;
  namespaceName: string;
  projectName: string;
  environmentName: string;
  componentName: string;
}

const formatTimestamp = (ts?: string) => {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
};

const formatDuration = (
  startTime?: string,
  completionTime?: string,
  status?: TriggerStatus,
): string => {
  if (status !== 'succeeded' && status !== 'failed') return '—';
  if (!startTime || !completionTime) return '—';
  const startMs = new Date(startTime).getTime();
  const endMs = new Date(completionTime).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) {
    return '—';
  }
  const totalSec = Math.round((endMs - startMs) / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return remM ? `${h}h ${remM}m` : `${h}h`;
};

const getStatusChipClass = (
  status: TriggerStatus,
  logClasses: ReturnType<typeof useLogEntryStyles>,
  triggerClasses: ReturnType<typeof useTriggersStyles>,
): string => {
  switch (status) {
    case 'succeeded':
      return triggerClasses.successChip;
    case 'failed':
      return logClasses.errorChip;
    case 'running':
      return triggerClasses.runningChip;
    default:
      return logClasses.undefinedChip;
  }
};

export const TriggerRow: FC<TriggerRowProps> = ({
  trigger,
  namespaceName,
  projectName,
  environmentName,
  componentName,
}) => {
  const logClasses = useLogEntryStyles();
  const triggerClasses = useTriggersStyles();
  const [expanded, setExpanded] = useState(false);

  const {
    retries,
    loading: retriesLoading,
    error: retriesError,
    fetchRetries,
  } = useRetries({
    jobName: expanded ? trigger.jobName : '',
    namespaceName,
    projectName,
    environmentName,
    componentName,
  });

  useEffect(() => {
    if (expanded) {
      fetchRetries();
    }
  }, [expanded, fetchRetries]);

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
            label={
              trigger.status === 'failed' && trigger.failureReason ? (
                <>
                  {trigger.status.toUpperCase()}
                  <span className={triggerClasses.statusChipReason}>
                    ({trigger.failureReason})
                  </span>
                </>
              ) : (
                trigger.status.toUpperCase()
              )
            }
            className={`${logClasses.logLevelChip} ${getStatusChipClass(trigger.status, logClasses, triggerClasses)}`}
          />
        </TableCell>
        <TableCell className={logClasses.monospaceCell}>
          {trigger.jobName}
        </TableCell>
        <TableCell style={{ fontSize: '0.75rem' }}>
          {formatTimestamp(trigger.startTime)}
        </TableCell>
        <TableCell style={{ fontSize: '0.75rem' }}>
          {formatTimestamp(trigger.completionTime)}
        </TableCell>
        <TableCell style={{ fontSize: '0.75rem' }}>
          {formatDuration(
            trigger.startTime,
            trigger.completionTime,
            trigger.status,
          )}
        </TableCell>
        <TableCell style={{ fontSize: '0.75rem' }}>
          {trigger.eventCount}
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow>
          <TableCell colSpan={6} style={{ paddingBottom: 0, paddingTop: 0 }}>
            <Collapse in={expanded} timeout="auto" unmountOnExit>
              <Box className={logClasses.expandedContent}>
                <Typography className={triggerClasses.sectionTitle}>
                  Retries ({retries.length} pod{retries.length !== 1 ? 's' : ''})
                </Typography>

                {retriesLoading && (
                  <Box display="flex" justifyContent="center" p={2}>
                    <CircularProgress size={20} />
                  </Box>
                )}

                {retriesError && (
                  <Typography variant="body2" color="error">
                    {retriesError}
                  </Typography>
                )}

                {!retriesLoading && !retriesError && retries.length > 0 && (
                  <Table
                    size="small"
                    className={triggerClasses.retriesTable}
                  >
                    <TableHead>
                      <TableRow>
                        <TableCell>Status</TableCell>
                        <TableCell>Pod Name</TableCell>
                        <TableCell>Start Time</TableCell>
                        <TableCell>Events</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {retries.map(retry => (
                        <RetryRow
                          key={retry.podName}
                          retry={retry}
                          namespaceName={namespaceName}
                          projectName={projectName}
                          environmentName={environmentName}
                          componentName={componentName}
                          triggerStartTime={trigger.startTime}
                          triggerCompletionTime={trigger.completionTime}
                        />
                      ))}
                    </TableBody>
                  </Table>
                )}

                {!retriesLoading && !retriesError && retries.length === 0 && (
                  <Typography
                    variant="body2"
                    color="textSecondary"
                    style={{ padding: 8 }}
                  >
                    No retry pods found for this trigger.
                  </Typography>
                )}

              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};
