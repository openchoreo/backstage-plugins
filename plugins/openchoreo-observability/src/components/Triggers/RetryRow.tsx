import { FC, useState } from 'react';
import {
  TableRow,
  TableCell,
  Chip,
  Collapse,
  Box,
  Typography,
} from '@material-ui/core';
import type { Retry, RetryStatus } from './types';
import { useLogEntryStyles } from '../RuntimeLogs/styles';
import { useTriggersStyles } from './styles';

interface RetryRowProps {
  retry: Retry;
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

export const RetryRow: FC<RetryRowProps> = ({ retry }) => {
  const logClasses = useLogEntryStyles();
  const triggerClasses = useTriggersStyles();
  const [expanded, setExpanded] = useState(false);

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

      {expanded && retry.events && retry.events.length > 0 && (
        <TableRow>
          <TableCell colSpan={4} style={{ paddingBottom: 0, paddingTop: 0 }}>
            <Collapse in={expanded} timeout="auto" unmountOnExit>
              <Box className={logClasses.expandedContent}>
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
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};
