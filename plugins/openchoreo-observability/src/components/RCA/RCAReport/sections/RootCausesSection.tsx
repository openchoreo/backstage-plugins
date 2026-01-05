import React from 'react';
import { Box, Typography, Divider, List, ListItem } from '@material-ui/core';
import { alpha, makeStyles } from '@material-ui/core/styles';
import DescriptionOutlinedIcon from '@material-ui/icons/DescriptionOutlined';
import ShowChartIcon from '@material-ui/icons/ShowChart';
import AccountTreeIcon from '@material-ui/icons/AccountTree';
import { FormattedText } from '../FormattedText';
import type { ObservabilityComponents } from '@openchoreo/backstage-plugin-common';

type RootCause = ObservabilityComponents['schemas']['RootCause'];
type LogEvidenceItem = ObservabilityComponents['schemas']['LogEvidenceItem'];
type MetricEvidenceItem =
  ObservabilityComponents['schemas']['MetricEvidenceItem'];
type TraceEvidenceItem =
  ObservabilityComponents['schemas']['TraceEvidenceItem'];
type SpanInfo = ObservabilityComponents['schemas']['SpanInfo'];

interface SpanTreeNode extends SpanInfo {
  children: SpanTreeNode[];
}

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
    fontWeight: 600,
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
  evidenceContainer: {
    marginTop: theme.spacing(2),
  },
  evidenceHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
    color: theme.palette.primary.main,
    fontSize: theme.typography.body2.fontSize,
    fontWeight: 600,
  },
  evidenceCard: {
    marginBottom: theme.spacing(2),
    marginTop: theme.spacing(2),
  },
  evidenceTopRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing(1),
  },
  componentName: {
    fontSize: theme.typography.caption.fontSize,
    color: theme.palette.text.secondary,
    fontWeight: 500,
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
    fontWeight: 600,
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
  timestamp: {
    color: theme.palette.text.secondary,
    fontSize: theme.typography.overline.fontSize,
  },
  logLevel: {
    fontSize: theme.typography.caption.fontSize,
    fontWeight: 600,
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
  evidenceDescription: {
    fontSize: theme.typography.caption.fontSize,
    color: theme.palette.text.secondary,
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
  metricTimestamp: {
    color: theme.palette.text.secondary,
    fontSize: theme.typography.overline.fontSize,
  },
  metricValue: {
    fontWeight: 600,
    fontSize: theme.typography.caption.fontSize,
  },
  criticalMetric: {
    color: theme.palette.error.main,
  },
  warningMetric: {
    color: theme.palette.warning.main,
  },
  normalMetric: {
    color: theme.palette.success.main,
  },
  metricDescription: {
    flex: 1,
    wordBreak: 'break-word',
  },
  traceIdLabel: {
    color: theme.palette.primary.main,
    fontWeight: 600,
    fontSize: theme.typography.caption.fontSize,
  },
  traceId: {
    fontWeight: 600,
    color: theme.palette.info.main,
  },
  spansContainer: {
    marginTop: theme.spacing(1),
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: theme.spacing(0.5),
  },
  spanItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.25, 0.75),
    backgroundColor:
      theme.palette.type === 'dark'
        ? 'rgba(255, 255, 255, 0.08)'
        : 'rgba(0, 0, 0, 0.06)',
    borderRadius: theme.shape.borderRadius,
    fontSize: theme.typography.caption.fontSize,
  },
  spanName: {
    color: theme.palette.text.primary,
  },
  spanDuration: {
    color: theme.palette.text.secondary,
  },
  spanError: {
    color: theme.palette.error.main,
    fontWeight: 600,
  },
  traceDuration: {
    fontSize: theme.typography.caption.fontSize,
    fontWeight: 600,
    color: theme.palette.primary.main,
  },
  traceTreeView: {
    marginTop: theme.spacing(1),
  },
  spanTreeLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0.25, 0),
    fontFamily: 'monospace',
    fontSize: theme.typography.caption.fontSize,
  },
  spanTreeName: {
    color: theme.palette.text.primary,
  },
  spanTreeDuration: {
    color: theme.palette.text.secondary,
  },
  spanTreeError: {
    color: theme.palette.error.main,
    fontWeight: 600,
  },
  spanTreeChildren: {
    paddingLeft: theme.spacing(3),
  },
  spanTreeRoot: {
    padding: theme.spacing(0.75, 1),
    backgroundColor: alpha(theme.palette.text.primary, 0.03),
    borderRadius: theme.shape.borderRadius,
    borderLeft: `3px solid ${theme.palette.success.main}`,
  },
  spanTreeChild: {
    padding: theme.spacing(0.75, 1),
    backgroundColor: alpha(theme.palette.text.primary, 0.03),
    borderLeft: `3px solid ${theme.palette.divider}`,
  },
}));

const buildSpanTree = (spans: SpanInfo[]): SpanTreeNode[] => {
  const spanMap = new Map<string, SpanTreeNode>();
  const roots: SpanTreeNode[] = [];

  spans.forEach(span => {
    spanMap.set(span.span_id, { ...span, children: [] });
  });

  spans.forEach(span => {
    const node = spanMap.get(span.span_id)!;
    if (span.parent_span_id && spanMap.has(span.parent_span_id)) {
      spanMap.get(span.parent_span_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
};

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

const getMetricSeverityClass = (
  severity: 'critical' | 'warning' | 'normal',
  classes: ReturnType<typeof useStyles>,
): string => {
  switch (severity) {
    case 'critical':
      return classes.criticalMetric;
    case 'warning':
      return classes.warningMetric;
    case 'normal':
      return classes.normalMetric;
    default:
      return '';
  }
};

const LogEvidence = ({
  evidence,
  classes,
}: {
  evidence: LogEvidenceItem;
  classes: ReturnType<typeof useStyles>;
}) => (
  <Box className={classes.evidenceCard}>
    <Box className={classes.evidenceTopRow}>
      <span
        className={`${classes.logLevel} ${getLogLevelColorClass(
          evidence.log_level,
          classes,
        )}`}
      >
        {evidence.log_level}
      </span>
      <span className={classes.componentName}>
        <FormattedText text={`{{comp:${evidence.component_uid}}}`} /> component
      </span>
    </Box>
    <Box className={classes.logLine}>
      <span className={classes.logMessageText}>{evidence.log_message}</span>
    </Box>
    <Box className={classes.evidenceFooter}>
      <span className={classes.timestamp}>
        {formatTimestamp(evidence.timestamp)}
      </span>
      <Box className={classes.evidenceTypeLabel}>
        <DescriptionOutlinedIcon className={classes.evidenceIcon} />
        <span>Log</span>
      </Box>
    </Box>
  </Box>
);

const MetricEvidence = ({
  evidence,
  classes,
}: {
  evidence: MetricEvidenceItem;
  classes: ReturnType<typeof useStyles>;
}) => (
  <Box className={classes.evidenceCard}>
    <Box className={classes.evidenceTopRow}>
      <span
        className={`${classes.metricValue} ${getMetricSeverityClass(
          evidence.severity,
          classes,
        )}`}
      >
        <FormattedText text={`${evidence.value} ${evidence.metric_name}`} />
      </span>
      <span className={classes.componentName}>
        <FormattedText text={`{{comp:${evidence.component_uid}}}`} /> component
      </span>
    </Box>
    <Box className={classes.metricLine}>
      <span className={classes.metricDescription}>
        <FormattedText text={evidence.description} />
      </span>
    </Box>
    <Box className={classes.evidenceFooter}>
      <span className={classes.metricTimestamp}>
        {formatTimestamp(evidence.time_range.start)} -{' '}
        {formatTimestamp(evidence.time_range.end)}
      </span>
      <Box className={classes.evidenceTypeLabel}>
        <ShowChartIcon className={classes.evidenceIcon} />
        <span>Metric</span>
      </Box>
    </Box>
  </Box>
);

const SpanTreeItem = ({
  node,
  classes,
  isRoot = false,
}: {
  node: SpanTreeNode;
  classes: ReturnType<typeof useStyles>;
  isRoot?: boolean;
}) => (
  <Box>
    <Box
      className={`${classes.spanTreeLabel} ${
        isRoot ? classes.spanTreeRoot : classes.spanTreeChild
      }`}
    >
      <span className={classes.spanTreeName}>{node.name}</span>
      <span className={classes.spanTreeDuration}>{node.duration_ms}ms</span>
      {node.is_error && <span className={classes.spanTreeError}>Error</span>}
    </Box>
    {node.children.length > 0 && (
      <Box className={classes.spanTreeChildren}>
        {node.children.map(child => (
          <SpanTreeItem key={child.span_id} node={child} classes={classes} />
        ))}
      </Box>
    )}
  </Box>
);

const TraceEvidence = ({
  evidence,
  classes,
}: {
  evidence: TraceEvidenceItem;
  classes: ReturnType<typeof useStyles>;
}) => {
  const spanTree = evidence.significant_spans
    ? buildSpanTree(evidence.significant_spans)
    : [];

  return (
    <Box className={classes.evidenceCard}>
      <Box className={classes.evidenceTopRow}>
        <span className={classes.traceDuration}>
          {evidence.total_duration_ms}ms
        </span>
        <span className={classes.componentName}>
          <FormattedText text={`{{comp:${evidence.component_uid}}}`} />{' '}
          component
        </span>
      </Box>
      <Box className={classes.traceTreeView}>
        <Box className={classes.spanTreeRoot}>
          <span className={classes.traceIdLabel}>Trace ID</span>{' '}
          <span className={classes.spanTreeName}>{evidence.trace_id}</span>
        </Box>
        {spanTree.length > 0 && (
          <Box className={classes.spanTreeChildren}>
            {spanTree.map(node => (
              <SpanTreeItem key={node.span_id} node={node} classes={classes} />
            ))}
          </Box>
        )}
      </Box>
      <Box className={classes.evidenceFooter}>
        <span className={classes.timestamp}>
          {evidence.significant_spans && evidence.significant_spans.length > 0
            ? `${evidence.significant_spans.length} span${
                evidence.significant_spans.length > 1 ? 's' : ''
              }`
            : ''}
        </span>
        <Box className={classes.evidenceTypeLabel}>
          <AccountTreeIcon className={classes.evidenceIcon} />
          <span>Trace</span>
        </Box>
      </Box>
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
        <FormattedText text={rootCause.description} />
      </Typography>
      <span className={getConfidenceBadgeClass(rootCause.confidence, classes)}>
        {rootCause.confidence}
      </span>
    </Box>
    <Box className={classes.rootCauseContent}>
      {rootCause.analysis && (
        <Typography
          variant="body1"
          color="textSecondary"
          className={classes.analysis}
        >
          <FormattedText text={rootCause.analysis} />
        </Typography>
      )}

      {rootCause.evidences && rootCause.evidences.length > 0 && (
        <Box className={classes.evidenceContainer}>
          <Typography className={classes.evidenceHeader}>
            Supporting Evidence
          </Typography>
          {rootCause.evidences.map((evidence, idx) => {
            let evidenceComponent = null;
            if (evidence.type === 'log') {
              evidenceComponent = (
                <LogEvidence
                  evidence={evidence as LogEvidenceItem}
                  classes={classes}
                />
              );
            } else if (evidence.type === 'metric') {
              evidenceComponent = (
                <MetricEvidence
                  evidence={evidence as MetricEvidenceItem}
                  classes={classes}
                />
              );
            } else if (evidence.type === 'trace') {
              evidenceComponent = (
                <TraceEvidence
                  evidence={evidence as TraceEvidenceItem}
                  classes={classes}
                />
              );
            }

            return (
              <Box key={idx}>
                {evidenceComponent}
                {idx < rootCause.evidences!.length - 1 && <Divider />}
              </Box>
            );
          })}
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
        <React.Fragment key={idx}>
          <ListItem className={classes.listItem} disableGutters>
            <RootCauseItem rootCause={rootCause} classes={classes} />
          </ListItem>
          {idx < rootCauses.length - 1 && <Divider component="li" />}
        </React.Fragment>
      ))}
    </List>
  );
};
