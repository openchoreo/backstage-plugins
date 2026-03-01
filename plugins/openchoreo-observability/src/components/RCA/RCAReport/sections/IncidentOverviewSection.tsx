import { Box, Typography, Tooltip } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { InfoCard } from '@backstage/core-components';
import ReportProblemOutlinedIcon from '@material-ui/icons/ReportProblemOutlined';
import { FormattedText } from '../FormattedText';
import { useRCAReportStyles } from '../styles';
import type { AIRCAAgentComponents } from '@openchoreo/backstage-plugin-common';

type ReportAlertContext = AIRCAAgentComponents['schemas']['ReportAlertContext'];

interface IncidentOverviewSectionProps {
  summary: string;
  alertContext?: ReportAlertContext;
  reportId: string;
  reportTimestamp?: string;
  formatTimestamp: (timestamp?: string) => string;
}

// Styles for alert details subsection
const useAlertStyles = makeStyles(theme => ({
  sectionLabel: {
    color: theme.palette.text.secondary,
    fontSize: theme.typography.caption.fontSize,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontWeight: 500,
    marginBottom: theme.spacing(1),
  },
  propertyGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  },
  twoColumnGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: theme.spacing(1.5),
  },
  propertyRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: theme.spacing(2),
  },
  propertyKey: {
    fontWeight: 500,
    color: theme.palette.text.secondary,
    fontSize: theme.typography.body2.fontSize,
    minWidth: 100,
    flexShrink: 0,
  },
  propertyValue: {
    color: theme.palette.text.primary,
    fontSize: theme.typography.body2.fontSize,
    wordBreak: 'break-word',
  },
  propertyValueHighlight: {
    fontWeight: 500,
    color: theme.palette.warning.main,
  },
  thresholdLabel: {
    color: theme.palette.text.secondary,
  },
  severityCritical: {
    color: theme.palette.error.main,
    fontWeight: 500,
    textTransform: 'uppercase',
  },
  severityWarning: {
    color: theme.palette.warning.main,
    fontWeight: 500,
    textTransform: 'uppercase',
  },
  severityNormal: {
    color: theme.palette.success.main,
    fontWeight: 500,
    textTransform: 'uppercase',
  },
}));

const getSeverityClass = (
  severity: string,
  classes: ReturnType<typeof useAlertStyles>,
): string => {
  switch (severity) {
    case 'critical':
      return classes.severityCritical;
    case 'warning':
      return classes.severityWarning;
    default:
      return classes.severityNormal;
  }
};

const formatMetricName = (metric: string): string => {
  return metric
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Alert Details subsection component
const AlertDetails = ({
  alertContext,
  summary,
  formatTimestamp,
  classes,
}: {
  alertContext: ReportAlertContext;
  summary: string;
  formatTimestamp: (timestamp?: string) => string;
  classes: ReturnType<typeof useAlertStyles>;
}) => (
  <>
    {/* Full-width fields */}
    <Box className={classes.propertyGrid}>
      <Box className={classes.propertyRow}>
        <Typography className={classes.propertyKey}>Alert</Typography>
        <Typography className={classes.propertyValue}>
          {alertContext.alert_name}
        </Typography>
      </Box>

      {alertContext.alert_description && (
        <Box className={classes.propertyRow}>
          <Typography className={classes.propertyKey}>Description</Typography>
          <Typography className={classes.propertyValue}>
            {alertContext.alert_description}
          </Typography>
        </Box>
      )}
    </Box>

    {/* Two-column grid for Triggered At and Metric */}
    <Box className={classes.twoColumnGrid} style={{ marginTop: 12 }}>
      <Box className={classes.propertyRow}>
        <Typography className={classes.propertyKey}>Triggered At</Typography>
        <Typography className={classes.propertyValue}>
          {formatTimestamp(alertContext.triggered_at)}
        </Typography>
      </Box>

      {alertContext.source_type === 'metric' && alertContext.source_metric && (
        <Box className={classes.propertyRow}>
          <Typography className={classes.propertyKey}>Metric</Typography>
          <Typography className={classes.propertyValue}>
            {formatMetricName(alertContext.source_metric)}
          </Typography>
        </Box>
      )}
    </Box>

    {/* Two-column grid for other shorter fields */}
    <Box className={classes.twoColumnGrid} style={{ marginTop: 12 }}>
      <Box className={classes.propertyRow}>
        <Typography className={classes.propertyKey}>Component</Typography>
        <Typography className={classes.propertyValue}>
          <FormattedText text={alertContext.component_uid} />
        </Typography>
      </Box>

      {alertContext.severity && (
        <Box className={classes.propertyRow}>
          <Typography className={classes.propertyKey}>Severity</Typography>
          <Typography
            className={`${classes.propertyValue} ${getSeverityClass(
              alertContext.severity,
              classes,
            )}`}
          >
            {alertContext.severity}
          </Typography>
        </Box>
      )}

      {alertContext.source_type && (
        <Box className={classes.propertyRow}>
          <Typography className={classes.propertyKey}>Source</Typography>
          <Typography className={classes.propertyValue}>
            {alertContext.source_type}
          </Typography>
        </Box>
      )}

      <Box className={classes.propertyRow}>
        <Typography className={classes.propertyKey}>Value</Typography>
        <Typography className={classes.propertyValue}>
          <span className={classes.propertyValueHighlight}>
            {alertContext.trigger_value}
            {alertContext.source_type === 'metric' ? '%' : ' occurrences'}
          </span>
          {alertContext.condition && (
            <span>
              {' '}
              (<span className={classes.thresholdLabel}>Threshold:</span>{' '}
              {alertContext.condition.operator}{' '}
              {alertContext.condition.threshold}
              {alertContext.source_type === 'metric' ? '%' : ''} in{' '}
              {alertContext.condition.window})
            </span>
          )}
        </Typography>
      </Box>
    </Box>

    {/* Log alert: show query pattern */}
    {alertContext.source_type === 'log' && alertContext.source_query && (
      <Box className={classes.propertyRow} style={{ marginTop: 12 }}>
        <Typography className={classes.propertyKey}>Log Pattern</Typography>
        <Typography className={classes.propertyValue}>
          {alertContext.source_query}
        </Typography>
      </Box>
    )}

    {/* Summary */}
    {summary && (
      <Box className={classes.propertyGrid} style={{ marginTop: 12 }}>
        <Box className={classes.propertyRow}>
          <Typography className={classes.propertyKey}>Summary</Typography>
          <Typography className={classes.propertyValue}>
            <FormattedText text={summary} />
          </Typography>
        </Box>
      </Box>
    )}
  </>
);

export const IncidentOverviewSection = ({
  summary,
  alertContext,
  reportId,
  reportTimestamp,
  formatTimestamp,
}: IncidentOverviewSectionProps) => {
  const classes = useRCAReportStyles();
  const alertClasses = useAlertStyles();

  return (
    <Box className={classes.infoCardSpacing}>
      <InfoCard
        title={
          <span className={classes.cardTitle}>
            <ReportProblemOutlinedIcon className={classes.cardTitleIcon} />
            Incident Overview
          </span>
        }
      >
        {alertContext ? (
          <AlertDetails
            alertContext={alertContext}
            summary={summary}
            formatTimestamp={formatTimestamp}
            classes={alertClasses}
          />
        ) : (
          <Box className={alertClasses.propertyGrid}>
            <Box className={alertClasses.propertyRow}>
              <Typography className={alertClasses.propertyKey}>
                Report ID
              </Typography>
              <Tooltip title={reportId} placement="top">
                <Typography className={alertClasses.propertyValue}>
                  {reportId}
                </Typography>
              </Tooltip>
            </Box>
            {reportTimestamp && (
              <Box className={alertClasses.propertyRow}>
                <Typography className={alertClasses.propertyKey}>
                  Generated At
                </Typography>
                <Typography className={alertClasses.propertyValue}>
                  {formatTimestamp(reportTimestamp)}
                </Typography>
              </Box>
            )}
            {summary && (
              <Box className={alertClasses.propertyRow}>
                <Typography className={alertClasses.propertyKey}>
                  Summary
                </Typography>
                <Typography className={alertClasses.propertyValue}>
                  <FormattedText text={summary} />
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </InfoCard>
    </Box>
  );
};
