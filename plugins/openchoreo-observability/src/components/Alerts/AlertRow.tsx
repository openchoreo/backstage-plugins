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
} from '@material-ui/core';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import type { AlertSummary } from '../../types';
import { useLogEntryStyles } from '../RuntimeLogs/styles';

interface AlertRowProps {
  alert: AlertSummary;
  environmentName?: string;
  projectName?: string;
  componentName?: string;
  namespaceName?: string;
  onViewIncident: (alert: AlertSummary) => void;
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

const getSeverityChipClass = (
  severity: string | undefined,
  classes: ReturnType<typeof useLogEntryStyles>,
): string => {
  switch (severity?.toLowerCase()) {
    case 'critical':
      return classes.errorChip;
    case 'warning':
      return classes.warnChip;
    case 'info':
      return classes.infoChip;
    default:
      return classes.undefinedChip;
  }
};

export const AlertRow: FC<AlertRowProps> = ({
  alert,
  environmentName,
  projectName,
  componentName,
  namespaceName,
  onViewIncident,
}) => {
  const classes = useLogEntryStyles();
  const [expanded, setExpanded] = useState(false);

  const handleRowClick = () => {
    setExpanded(prev => !prev);
  };

  const handleViewIncidentClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onViewIncident(alert);
  };

  const effectiveProject = alert.projectName || projectName || '—';
  const effectiveComponent = alert.componentName || componentName || '—';
  const effectiveEnvironment = alert.environmentName || environmentName || '—';
  const effectiveNamespace = alert.namespaceName || namespaceName || '—';

  return (
    <>
      <TableRow
        hover
        className={`${classes.logRow} ${expanded ? classes.expandedRow : ''}`}
        onClick={handleRowClick}
      >
        <TableCell style={{ fontSize: '0.75rem' }}>
          {formatTimestamp(alert.timestamp)}
        </TableCell>
        <TableCell>
          <Typography variant="body2" noWrap title={alert.ruleDescription}>
            {alert.ruleName || '—'}
          </Typography>
        </TableCell>
        <TableCell>
          <Chip
            size="small"
            label={(alert.severity || 'info').toUpperCase()}
            className={`${classes.logLevelChip} ${getSeverityChipClass(
              alert.severity,
              classes,
            )}`}
          />
        </TableCell>
        <TableCell style={{ fontSize: '0.75rem' }}>
          {alert.sourceType || '—'}
        </TableCell>
        <TableCell style={{ fontSize: '0.75rem' }}>
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
          >
            <span>{alert.alertValue ?? '—'}</span>
            {alert.incidentEnabled && (
              <Tooltip title="View associated incident in project Incidents tab">
                <span className={classes.hoverActionButton}>
                  <Button
                    size="small"
                    startIcon={<OpenInNewIcon fontSize="small" />}
                    onClick={handleViewIncidentClick}
                    style={{ whiteSpace: 'nowrap', marginLeft: 8 }}
                  >
                    View incident
                  </Button>
                </span>
              </Tooltip>
            )}
          </Box>
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow>
          <TableCell colSpan={5} style={{ paddingBottom: 0, paddingTop: 0 }}>
            <Collapse in={expanded} timeout="auto" unmountOnExit>
              <Box className={classes.expandedContent}>
                <Box
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                  style={{ marginBottom: 8 }}
                >
                  <Typography className={classes.expandedSectionTitle}>
                    Alert details
                  </Typography>
                  {alert.incidentEnabled && (
                    <Tooltip title="View associated incident in project Incidents tab">
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<OpenInNewIcon fontSize="small" />}
                        onClick={handleViewIncidentClick}
                      >
                        View incident
                      </Button>
                    </Tooltip>
                  )}
                </Box>

                <Box className={classes.metadataBox}>
                  <Box className={classes.metadataGrid}>
                    <Box className={classes.metadataItem}>
                      <span className={classes.metadataKey}>Alert ID:</span>
                      <span className={classes.metadataValue}>
                        {alert.alertId || '—'}
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
                      <span className={classes.metadataKey}>Source Type:</span>
                      <span className={classes.metadataValue}>
                        {alert.sourceType || '—'}
                      </span>
                    </Box>

                    {alert.sourceType === 'log' && alert.sourceQuery && (
                      <Box className={classes.metadataItem}>
                        <span className={classes.metadataKey}>Log Query:</span>
                        <span className={classes.metadataValue}>
                          {alert.sourceQuery}
                        </span>
                      </Box>
                    )}

                    {alert.sourceType === 'metric' && alert.sourceMetric && (
                      <Box className={classes.metadataItem}>
                        <span className={classes.metadataKey}>Metric:</span>
                        <span className={classes.metadataValue}>
                          {alert.sourceMetric}
                        </span>
                      </Box>
                    )}

                    {alert.notificationChannels &&
                      alert.notificationChannels.length > 0 && (
                        <Box className={classes.metadataItem}>
                          <span className={classes.metadataKey}>
                            Notification Channels:
                          </span>
                          <span className={classes.metadataValue}>
                            {alert.notificationChannels.join(', ')}
                          </span>
                        </Box>
                      )}
                  </Box>

                  {alert.ruleDescription && (
                    <Box style={{ marginTop: 12 }}>
                      <Typography className={classes.metadataTitle}>
                        Rule description
                      </Typography>
                      <Typography
                        variant="body2"
                        className={classes.metadataValue}
                      >
                        {alert.ruleDescription}
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
