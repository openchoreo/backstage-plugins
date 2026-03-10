import { FC, MouseEvent, useState } from 'react';
import {
  TableRow,
  TableCell,
  Typography,
  Box,
  Chip,
  Collapse,
  Button,
  Tooltip,
  CircularProgress,
} from '@material-ui/core';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import CheckIcon from '@material-ui/icons/Check';
import DoneAllIcon from '@material-ui/icons/DoneAll';
import type { IncidentSummary } from '../../types';
import { useLogEntryStyles } from '../RuntimeLogs/styles';

interface IncidentRowProps {
  incident: IncidentSummary;
  namespaceName: string;
  projectName: string;
  environmentName?: string;
  onViewRCA: (incident: IncidentSummary) => void;
  onAcknowledge?: (incident: IncidentSummary) => void;
  onResolve?: (incident: IncidentSummary) => void;
  updating?: boolean;
}

const formatTimestamp = (ts?: string) => {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    return d.toLocaleString();
  } catch {
    return ts;
  }
};

const getStatusChipClass = (
  status: string | undefined,
  classes: ReturnType<typeof useLogEntryStyles>,
): string => {
  switch (status?.toLowerCase()) {
    case 'active':
      return classes.errorChip;
    case 'acknowledged':
      return classes.warnChip;
    case 'resolved':
      return classes.infoChip;
    default:
      return classes.undefinedChip;
  }
};

export const IncidentRow: FC<IncidentRowProps> = ({
  incident,
  namespaceName,
  projectName,
  environmentName,
  onViewRCA,
  onAcknowledge,
  onResolve,
  updating = false,
}) => {
  const classes = useLogEntryStyles();
  const [expanded, setExpanded] = useState(false);

  const handleRowClick = () => {
    setExpanded(prev => !prev);
  };

  const handleViewRCAClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onViewRCA(incident);
  };

  const handleAcknowledgeClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onAcknowledge?.(incident);
  };

  const handleResolveClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onResolve?.(incident);
  };

  const effectiveProject = incident.projectName || projectName || '—';
  const effectiveComponent = incident.componentName || '—';
  const effectiveEnvironment =
    incident.environmentName || environmentName || '—';
  const effectiveNamespace = incident.namespaceName || namespaceName || '—';
  const fullIncidentId = incident.incidentId || '';
  let shortIncidentId = '—';
  if (fullIncidentId) {
    if (fullIncidentId.length > 8) {
      shortIncidentId = `${fullIncidentId.slice(0, 8)}…`;
    } else {
      shortIncidentId = fullIncidentId;
    }
  }

  return (
    <>
      <TableRow
        hover
        className={`${classes.logRow} ${expanded ? classes.expandedRow : ''}`}
        onClick={handleRowClick}
      >
        <TableCell style={{ fontSize: '0.75rem' }}>
          {formatTimestamp(incident.triggeredAt || incident.timestamp)}
        </TableCell>
        <TableCell style={{ fontSize: '0.75rem' }}>
          {fullIncidentId ? (
            <Tooltip title={fullIncidentId}>
              <span>{shortIncidentId}</span>
            </Tooltip>
          ) : (
            shortIncidentId
          )}
        </TableCell>
        <TableCell>
          <Chip
            size="small"
            label={(incident.status || '—').toUpperCase()}
            className={`${classes.logLevelChip} ${getStatusChipClass(
              incident.status,
              classes,
            )}`}
          />
        </TableCell>
        <TableCell>
          <Typography
            variant="body2"
            style={{
              wordBreak: 'break-word',
              whiteSpace: 'normal',
              fontSize: '0.75rem',
            }}
          >
            {incident.description || '—'}
          </Typography>
        </TableCell>
        <TableCell style={{ fontSize: '0.75rem' }}>
          {effectiveComponent}
        </TableCell>
        <TableCell>
          {incident.incidentTriggerAiRca && (
            <Tooltip title="Open RCA Reports tab for this incident">
              <Button
                size="small"
                startIcon={<OpenInNewIcon fontSize="small" />}
                onClick={handleViewRCAClick}
              >
                View RCA
              </Button>
            </Tooltip>
          )}
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow>
          <TableCell colSpan={6} style={{ paddingBottom: 0, paddingTop: 0 }}>
            <Collapse in={expanded} timeout="auto" unmountOnExit>
              <Box className={classes.expandedContent}>
                <Box
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                  style={{ marginBottom: 8 }}
                >
                  <Typography className={classes.expandedSectionTitle}>
                    Incident details
                  </Typography>

                  <Box display="flex" style={{ gap: 8 }}>
                    {incident.incidentTriggerAiRca && (
                      <Tooltip title="Open RCA Reports tab for this incident">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<OpenInNewIcon fontSize="small" />}
                          onClick={handleViewRCAClick}
                        >
                          View RCA
                        </Button>
                      </Tooltip>
                    )}

                    {incident.status === 'active' && onAcknowledge && (
                      <Tooltip title="Mark this incident as acknowledged">
                        <span>
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={updating}
                            startIcon={
                              updating ? (
                                <CircularProgress size={14} />
                              ) : (
                                <CheckIcon fontSize="small" />
                              )
                            }
                            onClick={handleAcknowledgeClick}
                          >
                            Acknowledge
                          </Button>
                        </span>
                      </Tooltip>
                    )}

                    {incident.status === 'acknowledged' && onResolve && (
                      <Tooltip title="Mark this incident as resolved">
                        <span>
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={updating}
                            startIcon={
                              updating ? (
                                <CircularProgress size={14} />
                              ) : (
                                <DoneAllIcon fontSize="small" />
                              )
                            }
                            onClick={handleResolveClick}
                          >
                            Resolve
                          </Button>
                        </span>
                      </Tooltip>
                    )}
                  </Box>
                </Box>

                <Box className={classes.metadataBox}>
                  <Box className={classes.metadataGrid}>
                    <Box className={classes.metadataItem}>
                      <span className={classes.metadataKey}>Incident ID:</span>
                      <span className={classes.metadataValue}>
                        {fullIncidentId || '—'}
                      </span>
                    </Box>

                    <Box className={classes.metadataItem}>
                      <span className={classes.metadataKey}>Alert ID:</span>
                      <span className={classes.metadataValue}>
                        {incident.alertId || '—'}
                      </span>
                    </Box>

                    <Box className={classes.metadataItem}>
                      <span className={classes.metadataKey}>Project:</span>
                      <span className={classes.metadataValue}>
                        {effectiveProject}
                      </span>
                    </Box>

                    <Box className={classes.metadataItem}>
                      <span className={classes.metadataKey}>Component:</span>
                      <span className={classes.metadataValue}>
                        {effectiveComponent}
                      </span>
                    </Box>

                    <Box className={classes.metadataItem}>
                      <span className={classes.metadataKey}>Environment:</span>
                      <span className={classes.metadataValue}>
                        {effectiveEnvironment}
                      </span>
                    </Box>

                    <Box className={classes.metadataItem}>
                      <span className={classes.metadataKey}>Namespace:</span>
                      <span className={classes.metadataValue}>
                        {effectiveNamespace}
                      </span>
                    </Box>

                    <Box className={classes.metadataItem}>
                      <span className={classes.metadataKey}>Triggered At:</span>
                      <span className={classes.metadataValue}>
                        {formatTimestamp(
                          incident.triggeredAt || incident.timestamp,
                        )}
                      </span>
                    </Box>

                    {incident.acknowledgedAt && (
                      <Box className={classes.metadataItem}>
                        <span className={classes.metadataKey}>
                          Acknowledged At:
                        </span>
                        <span className={classes.metadataValue}>
                          {formatTimestamp(incident.acknowledgedAt)}
                        </span>
                      </Box>
                    )}

                    {incident.resolvedAt && (
                      <Box className={classes.metadataItem}>
                        <span className={classes.metadataKey}>
                          Resolved At:
                        </span>
                        <span className={classes.metadataValue}>
                          {formatTimestamp(incident.resolvedAt)}
                        </span>
                      </Box>
                    )}
                  </Box>

                  {incident.notes && (
                    <Box style={{ marginTop: 12 }}>
                      <Typography className={classes.metadataTitle}>
                        Notes
                      </Typography>
                      <Typography
                        variant="body2"
                        className={classes.metadataValue}
                      >
                        {incident.notes}
                      </Typography>
                    </Box>
                  )}

                  {incident.description && (
                    <Box style={{ marginTop: 12 }}>
                      <Typography className={classes.metadataTitle}>
                        Full description
                      </Typography>
                      <Typography
                        variant="body2"
                        className={classes.metadataValue}
                      >
                        {incident.description}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};
