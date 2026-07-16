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
import type { Run, RunStatus } from './types';
import { useLogEntryStyles } from '../RuntimeLogs/styles';
import { useRunsStyles } from './styles';
import { useRetries } from '../../hooks/useRetries';
import { RetryRow } from './RetryRow';

interface RunRowProps {
  run: Run;
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
  status?: RunStatus,
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
  status: RunStatus,
  logClasses: ReturnType<typeof useLogEntryStyles>,
  runClasses: ReturnType<typeof useRunsStyles>,
): string => {
  switch (status) {
    case 'succeeded':
      return runClasses.successChip;
    case 'failed':
      return logClasses.errorChip;
    case 'running':
      return runClasses.runningChip;
    default:
      return logClasses.undefinedChip;
  }
};

export const RunRow: FC<RunRowProps> = ({
  run,
  namespaceName,
  projectName,
  environmentName,
  componentName,
}) => {
  const logClasses = useLogEntryStyles();
  const runClasses = useRunsStyles();
  const [expanded, setExpanded] = useState(false);

  const {
    retries,
    loading: retriesLoading,
    error: retriesError,
    fetchRetries,
  } = useRetries({
    jobName: expanded ? run.jobName : '',
    namespaceName,
    projectName,
    environmentName,
    componentName,
    // Scope retries fetch to this run's lifetime. When still running,
    // `completionTime` is undefined — `useRetries` only forwards the pair
    // when both are non-empty, so the backend uses its 30-day fallback.
    startTime: run.startTime,
    endTime: run.completionTime || undefined,
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
              run.status === 'failed' && run.failureReason ? (
                <>
                  {run.status.toUpperCase()}
                  <span className={runClasses.statusChipReason}>
                    ({run.failureReason})
                  </span>
                </>
              ) : (
                run.status.toUpperCase()
              )
            }
            className={`${logClasses.logLevelChip} ${getStatusChipClass(run.status, logClasses, runClasses)}`}
          />
        </TableCell>
        <TableCell className={logClasses.monospaceCell}>
          {run.jobName}
        </TableCell>
        <TableCell style={{ fontSize: '0.75rem' }}>
          {formatTimestamp(run.startTime)}
        </TableCell>
        <TableCell style={{ fontSize: '0.75rem' }}>
          {formatTimestamp(run.completionTime)}
        </TableCell>
        <TableCell style={{ fontSize: '0.75rem' }}>
          {formatDuration(
            run.startTime,
            run.completionTime,
            run.status,
          )}
        </TableCell>
        <TableCell style={{ fontSize: '0.75rem' }}>
          {run.eventCount}
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow>
          <TableCell colSpan={6} style={{ paddingBottom: 0, paddingTop: 0 }}>
            <Collapse in={expanded} timeout="auto" unmountOnExit>
              <Box className={logClasses.expandedContent}>
                <Typography className={runClasses.sectionTitle}>
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
                    className={runClasses.retriesTable}
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
                          runStartTime={run.startTime}
                          runCompletionTime={run.completionTime}
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
                    No retry pods found for this run.
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
