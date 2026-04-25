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
            label={trigger.status.toUpperCase()}
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
          {trigger.eventCount}
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow>
          <TableCell colSpan={5} style={{ paddingBottom: 0, paddingTop: 0 }}>
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

                {trigger.events && trigger.events.length > 0 && (
                  <>
                    <Typography className={triggerClasses.sectionTitle}>
                      Trigger Events
                    </Typography>
                    <Box className={logClasses.metadataBox}>
                      {trigger.events.map((event, idx) => (
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
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};
