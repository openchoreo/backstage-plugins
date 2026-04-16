import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Tooltip,
  IconButton,
  Divider,
  useTheme,
  CircularProgress,
} from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline';
import { useWaterfallStyles } from './styles';
import { Span, SpanDetails } from '../../types';
import {
  parseRfc3339NanoToNanoseconds,
  formatDuration,
  formatTimeFromString,
} from './utils';

interface SpanDetailsHook {
  fetchSpanDetails: (traceId: string, spanId: string) => Promise<void>;
  getDetails: (traceId: string, spanId: string) => SpanDetails | undefined;
  isLoading: (traceId: string, spanId: string) => boolean;
  getError: (traceId: string, spanId: string) => string | undefined;
}

interface WaterfallViewProps {
  traceId: string;
  spans: Span[];
  spanDetails: SpanDetailsHook;
}

interface SpanWithDepth extends Span {
  depth: number;
  children: SpanWithDepth[];
}

/** Flatten a nested object into dot-separated key: value rows. */
function flattenObject(
  obj: Record<string, unknown>,
  prefix = '',
): Array<{ key: string; value: string }> {
  const rows: Array<{ key: string; value: string }> = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      rows.push(...flattenObject(v as Record<string, unknown>, fullKey));
    } else {
      rows.push({ key: fullKey, value: String(v ?? '') });
    }
  }
  return rows;
}

interface AttributeSectionProps {
  label: string;
  data: Record<string, unknown> | undefined;
}

const AttributeSection = ({ label, data }: AttributeSectionProps) => {
  const theme = useTheme();
  if (!data || Object.keys(data).length === 0) return null;
  const rows = flattenObject(data);
  return (
    <Box mb={2}>
      <Typography
        variant="caption"
        style={{
          fontSize: '0.65rem',
          fontWeight: 700,
          display: 'block',
          marginBottom: 4,
          color: theme.palette.text.secondary,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </Typography>
      {rows.map(({ key, value }) => (
        <Box key={key} display="flex" style={{ gap: 8, marginBottom: 2 }}>
          <Typography
            variant="caption"
            style={{
              fontSize: '0.7rem',
              fontFamily: 'monospace',
              fontWeight: 600,
              minWidth: 220,
              flexShrink: 0,
              wordBreak: 'break-all',
            }}
          >
            {key}
          </Typography>
          <Typography
            variant="caption"
            style={{
              fontSize: '0.7rem',
              fontFamily: 'monospace',
              wordBreak: 'break-word',
            }}
          >
            {value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
};

interface SpanDetailsPanelProps {
  details: SpanDetails;
  traceId: string;
}

const SpanDetailsPanel = ({ details, traceId }: SpanDetailsPanelProps) => {
  const theme = useTheme();
  const coreFields: Array<{ label: string; value: string }> = [
    { label: 'Trace ID', value: traceId },
    { label: 'Span ID', value: details.spanId },
    { label: 'Span Name', value: details.spanName },
    ...(details.spanKind
      ? [{ label: 'Span Kind', value: details.spanKind }]
      : []),
    ...(details.parentSpanId
      ? [{ label: 'Parent Span ID', value: details.parentSpanId }]
      : []),
    { label: 'Start Time', value: formatTimeFromString(details.startTime) },
    { label: 'End Time', value: formatTimeFromString(details.endTime) },
    { label: 'Duration', value: formatDuration(details.durationNs) },
  ];

  let statusColor = '#94A3B8';
  if (details.status === 'error') {
    statusColor = '#EF4444';
  } else if (details.status === 'ok') {
    statusColor = '#10B981';
  }

  return (
    <Box>
      {/* Core span fields */}
      <Box mb={2}>
        <Typography
          variant="caption"
          style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            display: 'block',
            marginBottom: 4,
            color: theme.palette.text.secondary,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Span Info
        </Typography>
        {coreFields.map(({ label, value }) => (
          <Box key={label} display="flex" style={{ gap: 8, marginBottom: 2 }}>
            <Typography
              variant="caption"
              style={{
                fontSize: '0.7rem',
                fontFamily: 'monospace',
                fontWeight: 600,
                minWidth: 220,
                flexShrink: 0,
              }}
            >
              {label}
            </Typography>
            <Typography
              variant="caption"
              style={{
                fontSize: '0.7rem',
                fontFamily: 'monospace',
                wordBreak: 'break-all',
              }}
            >
              {value}
            </Typography>
          </Box>
        ))}
        {details.status && (
          <Box display="flex" style={{ gap: 8, marginBottom: 2 }}>
            <Typography
              variant="caption"
              style={{
                fontSize: '0.7rem',
                fontFamily: 'monospace',
                fontWeight: 600,
                minWidth: 220,
                flexShrink: 0,
              }}
            >
              Status
            </Typography>
            <Typography
              variant="caption"
              style={{
                fontSize: '0.7rem',
                fontFamily: 'monospace',
                fontWeight: 600,
                color: statusColor,
              }}
            >
              {details.status}
            </Typography>
          </Box>
        )}
      </Box>

      <AttributeSection label="Attributes" data={details.attributes} />
      <AttributeSection
        label="Resource Attributes"
        data={details.resourceAttributes}
      />
    </Box>
  );
};

export const WaterfallView = ({
  traceId,
  spans,
  spanDetails,
}: WaterfallViewProps) => {
  const classes = useWaterfallStyles();
  const theme = useTheme();
  const [collapsedSpans, setCollapsedSpans] = useState<Set<string>>(new Set());
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);

  // Color palette for different span types
  const getSpanColor = (
    spanName: string,
    depth: number,
    status?: string,
  ): string => {
    if (status === 'error') return '#FCA5A5'; // light red

    const colors = [
      '#93C5FD', // blue-300
      '#CBD5E1', // slate-300
      '#C4B5FD', // violet-300
      '#6EE7B7', // emerald-300
      '#67E8F9', // cyan-300
    ];

    if (depth === 0) return colors[0];
    if (depth === 1) return colors[1];

    let hash = 0;
    for (let i = 0; i < spanName.length; i++) {
      hash = spanName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const { spanTree, minTime, timeRange } = useMemo(() => {
    if (!spans || spans.length === 0) {
      return { spanTree: [], minTime: 0, timeRange: 0 };
    }

    const times = spans.flatMap(span => [
      parseRfc3339NanoToNanoseconds(span.startTime),
      parseRfc3339NanoToNanoseconds(span.endTime),
    ]);

    const min = Math.min(...times);
    const max = Math.max(...times);
    const range = max - min || 1;

    const spanMap = new Map<string, SpanWithDepth>();
    const rootSpans: SpanWithDepth[] = [];

    spans.forEach(span => {
      spanMap.set(span.spanId, { ...span, depth: 0, children: [] });
    });

    spans.forEach(span => {
      const spanWithDepth = spanMap.get(span.spanId)!;

      if (span.parentSpanId && spanMap.has(span.parentSpanId)) {
        const parent = spanMap.get(span.parentSpanId)!;
        parent.children.push(spanWithDepth);
        spanWithDepth.depth = parent.depth + 1;
      } else {
        rootSpans.push(spanWithDepth);
      }
    });

    if (rootSpans.length === 0) {
      const sortedSpans = [...spans].sort((a, b) => {
        const aStart = parseRfc3339NanoToNanoseconds(a.startTime);
        const bStart = parseRfc3339NanoToNanoseconds(b.startTime);
        return aStart - bStart;
      });

      if (sortedSpans.length > 0) {
        const rootSpan = spanMap.get(sortedSpans[0].spanId)!;
        rootSpans.push(rootSpan);
        rootSpan.depth = 0;

        sortedSpans.slice(1).forEach(span => {
          const spanWithDepth = spanMap.get(span.spanId)!;
          const spanStart = parseRfc3339NanoToNanoseconds(span.startTime);
          const spanEnd = parseRfc3339NanoToNanoseconds(span.endTime);

          let parent: SpanWithDepth | null = null;
          let maxDepth = -1;

          sortedSpans.slice(0, sortedSpans.indexOf(span)).forEach(prevSpan => {
            const prevSpanWithDepth = spanMap.get(prevSpan.spanId);
            if (!prevSpanWithDepth) return;

            const prevStart = parseRfc3339NanoToNanoseconds(prevSpan.startTime);
            const prevEnd = parseRfc3339NanoToNanoseconds(prevSpan.endTime);

            if (
              spanStart >= prevStart &&
              spanEnd <= prevEnd &&
              prevSpanWithDepth.depth > maxDepth
            ) {
              parent = prevSpanWithDepth;
              maxDepth = prevSpanWithDepth.depth;
            }
          });

          if (parent) {
            const parentSpan = parent as SpanWithDepth;
            parentSpan.children.push(spanWithDepth);
            spanWithDepth.depth = parentSpan.depth + 1;
          } else {
            rootSpans.push(spanWithDepth);
            spanWithDepth.depth = 0;
          }
        });
      }
    }

    return { spanTree: rootSpans, minTime: min, timeRange: range };
  }, [spans]);

  const visibleSpans = useMemo(() => {
    const getVisibleSpans = (nodes: SpanWithDepth[]): SpanWithDepth[] => {
      const result: SpanWithDepth[] = [];
      nodes.forEach((node: SpanWithDepth) => {
        result.push(node);
        if (!collapsedSpans.has(node.spanId)) {
          result.push(...getVisibleSpans(node.children));
        }
      });
      return result;
    };
    return getVisibleSpans(spanTree);
  }, [spanTree, collapsedSpans]);

  const toggleCollapse = (spanId: string) => {
    setCollapsedSpans(prev => {
      const newSet = new Set(prev);
      if (newSet.has(spanId)) {
        newSet.delete(spanId);
      } else {
        newSet.add(spanId);
      }
      return newSet;
    });
  };

  const handleSpanClick = (spanId: string) => {
    if (selectedSpanId === spanId) {
      setSelectedSpanId(null);
      return;
    }
    setSelectedSpanId(spanId);
    spanDetails.fetchSpanDetails(traceId, spanId);
  };

  if (spanTree.length === 0) {
    return (
      <Box className={classes.container}>
        <Typography variant="body2" color="textSecondary">
          No spans available for this trace
        </Typography>
      </Box>
    );
  }

  const calculatePosition = (startTime: string): number => {
    const time = parseRfc3339NanoToNanoseconds(startTime);
    return ((time - minTime) / timeRange) * 100;
  };

  const calculateWidth = (startTime: string, endTime: string): number => {
    const start = parseRfc3339NanoToNanoseconds(startTime);
    const end = parseRfc3339NanoToNanoseconds(endTime);
    const duration = end - start;
    return (duration / timeRange) * 100;
  };

  const selectedSpan = selectedSpanId
    ? visibleSpans.find(s => s.spanId === selectedSpanId)
    : null;
  const selectedDetails = selectedSpanId
    ? spanDetails.getDetails(traceId, selectedSpanId)
    : null;
  const detailsLoading = selectedSpanId
    ? spanDetails.isLoading(traceId, selectedSpanId)
    : false;
  const detailsError = selectedSpanId
    ? spanDetails.getError(traceId, selectedSpanId)
    : null;

  return (
    <Box className={classes.container}>
      <Typography variant="subtitle2" gutterBottom>
        Trace ID: {traceId}
      </Typography>
      <Box className={classes.timeline}>
        {visibleSpans.map(span => {
          const left = calculatePosition(span.startTime);
          const width = Math.max(
            calculateWidth(span.startTime, span.endTime),
            0.5,
          );
          const color = getSpanColor(span.spanName, span.depth, span.status);
          const indent = span.depth * 20;
          const hasChildren = span.children.length > 0;
          const isCollapsed = collapsedSpans.has(span.spanId);
          const isSelected = selectedSpanId === span.spanId;

          return (
            <Box key={span.spanId} className={classes.spanRow}>
              <Box
                className={classes.spanLabel}
                style={{ paddingLeft: `${indent}px` }}
              >
                {hasChildren && (
                  <IconButton
                    size="small"
                    className={classes.collapseButton}
                    onClick={() => toggleCollapse(span.spanId)}
                  >
                    {isCollapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
                  </IconButton>
                )}
                {!hasChildren && <Box style={{ width: '20px' }} />}
                {span.status === 'error' && (
                  <Tooltip title="Span error">
                    <ErrorOutlineIcon className={classes.spanErrorIcon} />
                  </Tooltip>
                )}
                <Box
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                  title={span.spanName}
                >
                  {span.spanName}
                </Box>
              </Box>
              <Box className={classes.spanBarContainer}>
                <Tooltip
                  title={
                    <Box className={classes.tooltipContent}>
                      <Box className={classes.tooltipRow}>
                        <Typography
                          variant="subtitle2"
                          component="span"
                          style={{
                            fontWeight: 600,
                            color: 'inherit',
                            marginBottom: 8,
                          }}
                        >
                          {span.spanName}
                        </Typography>
                      </Box>
                      <Divider style={{ marginBottom: 8, marginTop: 4 }} />
                      <Box className={classes.tooltipRow}>
                        <Typography
                          variant="caption"
                          component="span"
                          className={classes.tooltipLabel}
                        >
                          Span ID:
                        </Typography>
                        <Typography
                          variant="caption"
                          style={{
                            fontFamily: 'monospace',
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word',
                            flex: 1,
                            minWidth: 0,
                          }}
                        >
                          {span.spanId}
                        </Typography>
                      </Box>
                      {span.spanKind && (
                        <Box className={classes.tooltipRow}>
                          <Typography
                            variant="caption"
                            component="span"
                            className={classes.tooltipLabel}
                          >
                            Kind:
                          </Typography>
                          <Typography variant="caption">
                            {span.spanKind}
                          </Typography>
                        </Box>
                      )}
                      <Box className={classes.tooltipRow}>
                        <Typography
                          variant="caption"
                          component="span"
                          className={classes.tooltipLabel}
                        >
                          Start Time:
                        </Typography>
                        <Typography
                          variant="caption"
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '0.7rem',
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word',
                            flex: 1,
                            minWidth: 0,
                          }}
                        >
                          {formatTimeFromString(span.startTime)}
                        </Typography>
                      </Box>
                      <Box className={classes.tooltipRow}>
                        <Typography
                          variant="caption"
                          component="span"
                          className={classes.tooltipLabel}
                        >
                          End Time:
                        </Typography>
                        <Typography
                          variant="caption"
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '0.7rem',
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word',
                            flex: 1,
                            minWidth: 0,
                          }}
                        >
                          {formatTimeFromString(span.endTime)}
                        </Typography>
                      </Box>
                      <Box className={classes.tooltipRow}>
                        <Typography
                          variant="caption"
                          component="span"
                          className={classes.tooltipLabel}
                        >
                          Duration:
                        </Typography>
                        <Typography
                          variant="caption"
                          style={{ fontWeight: 500 }}
                        >
                          {formatDuration(span.durationNs)}
                        </Typography>
                      </Box>
                      {span.status && (
                        <Box className={classes.tooltipRow}>
                          <Typography
                            variant="caption"
                            component="span"
                            className={classes.tooltipLabel}
                          >
                            Status:
                          </Typography>
                          <Typography variant="caption">
                            {span.status}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  }
                  arrow
                  placement="top"
                  enterDelay={200}
                  leaveDelay={100}
                >
                  <Box
                    className={classes.spanBar}
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      backgroundColor: color,
                      outline: isSelected
                        ? `2px solid ${theme.palette.primary.main}`
                        : undefined,
                    }}
                    onClick={() => handleSpanClick(span.spanId)}
                  >
                    {width > 5 && formatDuration(span.durationNs)}
                  </Box>
                </Tooltip>
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Span details panel — shown when a span bar is clicked */}
      {selectedSpanId && (
        <Box
          mt={2}
          p={2}
          style={{
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 4,
            backgroundColor: theme.palette.background.paper,
          }}
        >
          <Typography variant="subtitle2" gutterBottom>
            Span Details{selectedSpan ? `: ${selectedSpan.spanName}` : ''}
          </Typography>
          <Divider style={{ marginBottom: 8 }} />

          {detailsLoading && (
            <Box display="flex" alignItems="center" style={{ gap: 8 }}>
              <CircularProgress size={16} />
              <Typography variant="body2" color="textSecondary">
                Loading span details...
              </Typography>
            </Box>
          )}

          {detailsError && (
            <Typography variant="body2" color="error">
              Failed to load span details: {detailsError}
            </Typography>
          )}

          {selectedDetails && !detailsLoading && (
            <SpanDetailsPanel details={selectedDetails} traceId={traceId} />
          )}

          {!detailsLoading && !detailsError && !selectedDetails && (
            <Typography variant="body2" color="textSecondary">
              Click a span bar to view its details.
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
};
