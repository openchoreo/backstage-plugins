import { Fragment, useState } from 'react';
import {
  Box,
  Typography,
  Divider,
  List,
  ListItem,
  Collapse,
  ButtonBase,
} from '@material-ui/core';
import { alpha, makeStyles } from '@material-ui/core/styles';
import DescriptionOutlinedIcon from '@material-ui/icons/DescriptionOutlined';
import ShowChartIcon from '@material-ui/icons/ShowChart';
import AccountTreeIcon from '@material-ui/icons/AccountTree';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import { FormattedText } from '../FormattedText';
import type { ObservabilityComponents } from '@openchoreo/backstage-plugin-common';

type RootCause = ObservabilityComponents['schemas']['RootCause'];
type Finding = ObservabilityComponents['schemas']['Finding'];
type LogEvidence = ObservabilityComponents['schemas']['LogEvidence'];
type MetricEvidence = ObservabilityComponents['schemas']['MetricEvidence'];
type TraceEvidence = ObservabilityComponents['schemas']['TraceEvidence'];

interface RootCausesSectionProps {
  rootCauses?: RootCause[];
}

const useStyles = makeStyles(theme => ({
  list: {
    padding: 0,
  },
  listItem: {
    padding: theme.spacing(1.5, 0),
    display: 'block',
  },
  rootCauseHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(1),
  },
  rootCauseContent: {
    paddingLeft: theme.spacing(2),
  },
  rootCauseTitle: {
    fontSize: theme.typography.body2.fontSize,
    fontWeight: 500,
    color: theme.palette.text.primary,
    flex: 1,
    lineHeight: 1.4,
  },
  confidenceBadge: {
    padding: theme.spacing(0.5, 1.5),
    borderRadius: theme.shape.borderRadius,
    fontWeight: 500,
    fontSize: theme.typography.caption.fontSize,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  highConfidence: {
    backgroundColor: theme.palette.success.light,
    color: theme.palette.success.dark,
  },
  mediumConfidence: {
    backgroundColor: theme.palette.warning.light,
    color: theme.palette.warning.dark,
  },
  lowConfidence: {
    backgroundColor: theme.palette.error.light,
    color: theme.palette.error.dark,
  },
  analysis: {
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(2),
  },
  findingsContainer: {
    marginTop: theme.spacing(2),
  },
  findingsHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
    color: theme.palette.text.secondary,
    fontSize: theme.typography.body2.fontSize,
    fontWeight: 500,
  },
  findingCard: {
    marginBottom: theme.spacing(1.5),
    marginTop: theme.spacing(1.5),
    borderRadius: theme.shape.borderRadius,
    overflow: 'hidden',
  },
  findingHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5),
    width: '100%',
    textAlign: 'left',
    backgroundColor: 'transparent',
    transition: 'background-color 0.15s ease',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  findingHeaderContent: {
    flex: 1,
    minWidth: 0,
  },
  findingObservation: {
    fontWeight: 500,
    fontSize: theme.typography.body2.fontSize,
    color: theme.palette.text.primary,
    marginBottom: theme.spacing(0.5),
    lineHeight: 1.4,
  },
  findingMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    flexWrap: 'wrap' as const,
  },
  evidenceTypeBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    fontSize: theme.typography.caption.fontSize,
    fontWeight: 500,
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(0.5),
    '& a': {
      color: theme.palette.primary.main,
      fontWeight: 500,
    },
  },
  evidenceTypeBadgeIcon: {
    fontSize: '0.875rem',
    color: theme.palette.primary.main,
  },
  expandIcon: {
    color: theme.palette.text.secondary,
    transition: 'transform 0.2s ease',
    flexShrink: 0,
    marginTop: theme.spacing(0.25),
  },
  expandIconOpen: {
    transform: 'rotate(180deg)',
  },
  findingEvidenceContainer: {
    padding: theme.spacing(0, 1.5, 1.5, 1.5),
    borderTop: `1px solid ${theme.palette.divider}`,
    backgroundColor: alpha(theme.palette.background.default, 0.5),
  },
  componentName: {
    fontSize: theme.typography.caption.fontSize,
    color: theme.palette.text.secondary,
    fontWeight: 500,
    marginBottom: theme.spacing(1),
    marginTop: theme.spacing(1),
  },
  timeRange: {
    fontSize: theme.typography.caption.fontSize,
    color: theme.palette.text.secondary,
  },
  evidenceCard: {
    marginTop: theme.spacing(1),
  },
  evidenceTopRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing(1),
  },
  evidenceFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing(1),
  },
  evidenceTypeLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    fontSize: theme.typography.caption.fontSize,
    fontWeight: 500,
    color: theme.palette.text.primary,
    marginRight: theme.spacing(1),
  },
  evidenceIcon: {
    fontSize: '1rem',
    color: theme.palette.primary.main,
  },
  logLine: {
    fontFamily: 'monospace',
    fontSize: theme.typography.caption.fontSize,
    marginTop: theme.spacing(0.75),
    padding: theme.spacing(0.75, 1),
    backgroundColor:
      theme.palette.type === 'dark'
        ? 'rgba(255, 255, 255, 0.05)'
        : 'rgba(0, 0, 0, 0.03)',
    borderRadius: theme.shape.borderRadius,
    borderLeft: `3px solid ${theme.palette.success.main}`,
  },
  logLinesContainer: {
    marginTop: theme.spacing(0.75),
  },
  logLinesScrollContainer: {
    overflowX: 'auto',
    marginLeft: theme.spacing(-1.5),
    marginRight: theme.spacing(-1.5),
    paddingLeft: theme.spacing(1.5),
    paddingRight: theme.spacing(1.5),
  },
  logLineItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    fontFamily: 'monospace',
    fontSize: theme.typography.caption.fontSize,
    whiteSpace: 'nowrap',
    padding: theme.spacing(0.5, 0),
  },
  logLineDivider: {
    marginLeft: theme.spacing(-1.5),
    marginRight: theme.spacing(-1.5),
  },
  timestamp: {
    color: theme.palette.text.secondary,
    fontSize: theme.typography.overline.fontSize,
  },
  logLevel: {
    fontSize: theme.typography.caption.fontSize,
    fontWeight: 500,
  },
  errorLevel: {
    color: theme.palette.error.main,
  },
  warnLevel: {
    color: theme.palette.warning.main,
  },
  infoLevel: {
    color: theme.palette.info.main,
  },
  debugLevel: {
    color: theme.palette.text.secondary,
  },
  logMessageText: {
    flex: 1,
    wordBreak: 'break-word',
  },
  repetitionText: {
    fontStyle: 'italic',
    color: theme.palette.text.secondary,
    fontSize: theme.typography.caption.fontSize,
    marginTop: theme.spacing(0.5),
  },
  metricLine: {
    fontFamily: 'monospace',
    fontSize: theme.typography.caption.fontSize,
    marginTop: theme.spacing(0.75),
    padding: theme.spacing(0.75, 1),
    backgroundColor:
      theme.palette.type === 'dark'
        ? 'rgba(255, 255, 255, 0.05)'
        : 'rgba(0, 0, 0, 0.03)',
    borderRadius: theme.shape.borderRadius,
    borderLeft: `3px solid ${theme.palette.success.main}`,
  },
  metricName: {
    fontWeight: 500,
    fontSize: theme.typography.body2.fontSize,
    color: theme.palette.text.primary,
  },
  metricSummary: {
    flex: 1,
    wordBreak: 'break-word',
  },
  tracePropertyRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(0.5),
  },
  tracePropertyKey: {
    fontWeight: 500,
    color: theme.palette.text.secondary,
    fontSize: theme.typography.body2.fontSize,
    minWidth: 50,
    flexShrink: 0,
  },
  tracePropertyValue: {
    fontFamily: 'monospace',
    color: theme.palette.text.primary,
    fontSize: theme.typography.body2.fontSize,
    wordBreak: 'break-word',
  },
  traceInfoBox: {
    padding: theme.spacing(0.75, 1),
    backgroundColor: alpha(theme.palette.text.primary, 0.03),
    borderRadius: theme.shape.borderRadius,
    borderLeft: `3px solid ${theme.palette.success.main}`,
  },
  traceSummary: {
    fontSize: theme.typography.body2.fontSize,
    color: theme.palette.text.primary,
    marginTop: theme.spacing(0.5),
  },
  traceError: {
    color: theme.palette.error.main,
    fontWeight: 500,
    marginTop: theme.spacing(0.5),
  },
  spanInfo: {
    fontSize: theme.typography.caption.fontSize,
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(0.5),
  },
}));

const getLogLevelColorClass = (
  level: string,
  classes: ReturnType<typeof useStyles>,
): string => {
  switch (level) {
    case 'ERROR':
      return classes.errorLevel;
    case 'WARN':
      return classes.warnLevel;
    case 'INFO':
      return classes.infoLevel;
    case 'DEBUG':
      return classes.debugLevel;
    default:
      return '';
  }
};

const getConfidenceBadgeClass = (
  confidence: string,
  classes: ReturnType<typeof useStyles>,
): string => {
  const base = classes.confidenceBadge;
  switch (confidence) {
    case 'high':
      return `${base} ${classes.highConfidence}`;
    case 'medium':
      return `${base} ${classes.mediumConfidence}`;
    case 'low':
      return `${base} ${classes.lowConfidence}`;
    default:
      return base;
  }
};

const formatTimestamp = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return timestamp;
  }
};

const LogEvidenceComponent = ({
  evidence,
  classes,
}: {
  evidence: LogEvidence;
  classes: ReturnType<typeof useStyles>;
}) => (
  <Box className={classes.evidenceCard}>
    <Box className={classes.logLinesScrollContainer}>
      {evidence.log_lines?.map((line, idx) => (
        <Fragment key={idx}>
          <Box className={classes.logLineItem}>
            <span className={classes.timestamp}>
              {formatTimestamp(line.timestamp)}
            </span>
            <span
              className={`${classes.logLevel} ${getLogLevelColorClass(
                line.level,
                classes,
              )}`}
            >
              {line.level}
            </span>
            <span className={classes.logMessageText}>{line.message}</span>
          </Box>
          <Divider className={classes.logLineDivider} />
        </Fragment>
      ))}
    </Box>
    {evidence.repetition && (
      <Typography className={classes.repetitionText}>
        {evidence.repetition}
      </Typography>
    )}
  </Box>
);

const MetricEvidenceComponent = ({
  evidence,
  classes,
}: {
  evidence: MetricEvidence;
  classes: ReturnType<typeof useStyles>;
}) => (
  <Box className={classes.evidenceCard}>
    <Typography component="div" className={classes.metricSummary}>
      <FormattedText text={evidence.summary} />
    </Typography>
  </Box>
);

const TraceEvidenceComponent = ({
  evidence,
  classes,
}: {
  evidence: TraceEvidence;
  classes: ReturnType<typeof useStyles>;
}) => (
  <Box className={classes.evidenceCard}>
    <Box className={classes.tracePropertyRow}>
      <span className={classes.tracePropertyKey}>Trace</span>
      <span className={classes.tracePropertyValue}>{evidence.trace_id}</span>
    </Box>
    {evidence.span_id && (
      <Box className={classes.tracePropertyRow}>
        <span className={classes.tracePropertyKey}>Span</span>
        <span className={classes.tracePropertyValue}>{evidence.span_id}</span>
      </Box>
    )}
    <Typography component="div" className={classes.traceSummary}>
      <FormattedText text={evidence.summary} />
    </Typography>
    {evidence.is_error && evidence.error_message && (
      <Typography className={classes.traceError}>
        Error: {evidence.error_message}
      </Typography>
    )}
    {evidence.repetition && (
      <>
        <Divider className={classes.logLineDivider} />
        <Typography className={classes.repetitionText}>
          {evidence.repetition}
        </Typography>
      </>
    )}
  </Box>
);

const getEvidenceTypeWithComponent = (
  type: string | undefined,
  componentUid: string | undefined,
  classes: ReturnType<typeof useStyles>,
) => {
  let icon = null;
  let label = '';

  switch (type) {
    case 'log':
      icon = (
        <DescriptionOutlinedIcon className={classes.evidenceTypeBadgeIcon} />
      );
      label = 'Logs';
      break;
    case 'metric':
      icon = <ShowChartIcon className={classes.evidenceTypeBadgeIcon} />;
      label = 'Metrics';
      break;
    case 'trace':
      icon = <AccountTreeIcon className={classes.evidenceTypeBadgeIcon} />;
      label = 'Traces';
      break;
    default:
      return null;
  }

  return (
    <span className={classes.evidenceTypeBadge}>
      {icon}
      {label}
      {componentUid && (
        <>
          {' in '}
          <FormattedText text={componentUid} />
        </>
      )}
    </span>
  );
};

const FindingCard = ({
  finding,
  classes,
}: {
  finding: Finding;
  classes: ReturnType<typeof useStyles>;
}) => {
  const [expanded, setExpanded] = useState(false);
  const evidence = finding.evidence;

  let evidenceComponent = null;
  if (evidence?.type === 'log') {
    evidenceComponent = (
      <LogEvidenceComponent
        evidence={evidence as LogEvidence}
        classes={classes}
      />
    );
  } else if (evidence?.type === 'metric') {
    evidenceComponent = (
      <MetricEvidenceComponent
        evidence={evidence as MetricEvidence}
        classes={classes}
      />
    );
  } else if (evidence?.type === 'trace') {
    evidenceComponent = (
      <TraceEvidenceComponent
        evidence={evidence as TraceEvidence}
        classes={classes}
      />
    );
  }

  const hasEvidence = evidenceComponent !== null;

  return (
    <Box className={classes.findingCard}>
      <ButtonBase
        className={classes.findingHeader}
        onClick={() => hasEvidence && setExpanded(!expanded)}
        disabled={!hasEvidence}
        disableRipple
      >
        <Box className={classes.findingHeaderContent}>
          <Typography component="div" className={classes.findingObservation}>
            <FormattedText text={finding.observation} disableMarkdown />
          </Typography>
          {evidence?.type &&
            getEvidenceTypeWithComponent(
              evidence.type,
              finding.component_uid,
              classes,
            )}
          {finding.time_range && (
            <span className={classes.timeRange}>
              {formatTimestamp(finding.time_range.start)} -{' '}
              {formatTimestamp(finding.time_range.end)}
            </span>
          )}
        </Box>
        {hasEvidence && (
          <ExpandMoreIcon
            className={`${classes.expandIcon} ${
              expanded ? classes.expandIconOpen : ''
            }`}
          />
        )}
      </ButtonBase>
      {hasEvidence && (
        <Collapse in={expanded}>
          <Box className={classes.findingEvidenceContainer}>
            {evidenceComponent}
          </Box>
        </Collapse>
      )}
    </Box>
  );
};

const RootCauseItem = ({
  rootCause,
  classes,
}: {
  rootCause: RootCause;
  classes: ReturnType<typeof useStyles>;
}) => (
  <>
    <Box className={classes.rootCauseHeader}>
      <Typography className={classes.rootCauseTitle}>
        <FormattedText text={rootCause.summary} disableMarkdown />
      </Typography>
      <span className={getConfidenceBadgeClass(rootCause.confidence, classes)}>
        {rootCause.confidence} confidence
      </span>
    </Box>
    <Box className={classes.rootCauseContent}>
      {rootCause.analysis && (
        <Typography
          component="div"
          variant="body1"
          color="textSecondary"
          className={classes.analysis}
        >
          <FormattedText text={rootCause.analysis} />
        </Typography>
      )}

      {rootCause.supporting_findings &&
        rootCause.supporting_findings.length > 0 && (
          <Box className={classes.findingsContainer}>
            <Typography className={classes.findingsHeader}>
              Supporting Findings
            </Typography>
            {rootCause.supporting_findings.map((finding, idx) => (
              <FindingCard key={idx} finding={finding} classes={classes} />
            ))}
          </Box>
        )}
    </Box>
  </>
);

export const RootCausesSection = ({ rootCauses }: RootCausesSectionProps) => {
  const classes = useStyles();

  if (!rootCauses || rootCauses.length === 0) {
    return null;
  }

  return (
    <List className={classes.list} disablePadding>
      {rootCauses.map((rootCause, idx) => (
        <Fragment key={idx}>
          <ListItem className={classes.listItem} disableGutters>
            <RootCauseItem rootCause={rootCause} classes={classes} />
          </ListItem>
          {idx < rootCauses.length - 1 && <Divider component="li" />}
        </Fragment>
      ))}
    </List>
  );
};
