import { useState, useMemo } from 'react';
import { Box, Typography, Tooltip, IconButton, Divider } from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import { useWaterfallStyles } from './styles';

export interface Span {
  durationInNanos: number;
  endTime: string;
  name: string;
  spanId: string;
  startTime: string;
  parentSpanId?: string;
}

export interface Trace {
  traceId: string;
  spans: Span[];
}

interface WaterfallViewProps {
  trace: Trace;
}

// Color palette for different span types
const getSpanColor = (name: string, depth: number): string => {
  const colors = [
    '#2196F3', // Light blue for root spans
    '#9C27B0', // Purple for nested spans
    '#E91E63', // Pink for deeper nested spans
    '#FF9800', // Orange
    '#4CAF50', // Green
  ];

  // Use depth to determine color, with fallback based on name
  if (depth === 0) return colors[0];
  if (depth === 1) return colors[1];
  if (depth >= 2) return colors[2];

  // Fallback: hash the name to get a consistent color
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const formatDuration = (nanos: number): string => {
  if (nanos === 0) return '0s';
  const ms = nanos / 1000000;
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  const seconds = ms / 1000;
  return `${seconds.toFixed(2)}s`;
};

const formatTime = (timeString: string): string => {
  try {
    const date = new Date(timeString);
    return date.toISOString();
  } catch {
    return timeString;
  }
};

interface SpanWithDepth extends Span {
  depth: number;
  children: SpanWithDepth[];
}

export const WaterfallView = ({ trace }: WaterfallViewProps) => {
  const classes = useWaterfallStyles();
  const [collapsedSpans, setCollapsedSpans] = useState<Set<string>>(new Set());

  const { spanTree, minTime, timeRange } = useMemo(() => {
    if (!trace.spans || trace.spans.length === 0) {
      return { spanTree: [], minTime: 0, timeRange: 0 };
    }

    // Parse all timestamps and find min/max
    const times = trace.spans.flatMap(span => [
      new Date(span.startTime).getTime(),
      new Date(span.endTime).getTime(),
    ]);

    const min = Math.min(...times);
    const max = Math.max(...times);
    const range = max - min || 1; // Avoid division by zero

    // Build span hierarchy using parentSpanId if available, otherwise use time-based nesting
    const spanMap = new Map<string, SpanWithDepth>();
    const rootSpans: SpanWithDepth[] = [];

    // First pass: create all span objects
    trace.spans.forEach(span => {
      spanMap.set(span.spanId, {
        ...span,
        depth: 0,
        children: [],
      });
    });

    // Second pass: build parent-child relationships
    trace.spans.forEach(span => {
      const spanWithDepth = spanMap.get(span.spanId)!;

      if (span.parentSpanId && spanMap.has(span.parentSpanId)) {
        const parent = spanMap.get(span.parentSpanId)!;
        parent.children.push(spanWithDepth);
        spanWithDepth.depth = parent.depth + 1;
      } else {
        // No parent or parent not found, treat as root
        rootSpans.push(spanWithDepth);
      }
    });

    // If no root spans found (all have parents but parentSpanId might be missing),
    // use time-based approach to find root
    if (rootSpans.length === 0) {
      const sortedSpans = [...trace.spans].sort((a, b) => {
        const aStart = new Date(a.startTime).getTime();
        const bStart = new Date(b.startTime).getTime();
        return aStart - bStart;
      });

      // First span is root
      if (sortedSpans.length > 0) {
        const rootSpan = spanMap.get(sortedSpans[0].spanId)!;
        rootSpans.push(rootSpan);
        rootSpan.depth = 0;

        // Build hierarchy based on time nesting
        sortedSpans.slice(1).forEach(span => {
          const spanWithDepth = spanMap.get(span.spanId)!;
          const spanStart = new Date(span.startTime).getTime();
          const spanEnd = new Date(span.endTime).getTime();

          // Find the deepest parent that contains this span
          let parent: SpanWithDepth | null = null;
          let maxDepth = -1;

          sortedSpans.slice(0, sortedSpans.indexOf(span)).forEach(prevSpan => {
            const prevSpanWithDepth = spanMap.get(prevSpan.spanId);
            if (!prevSpanWithDepth) return;

            const prevStart = new Date(prevSpan.startTime).getTime();
            const prevEnd = new Date(prevSpan.endTime).getTime();

            if (spanStart >= prevStart && spanEnd <= prevEnd && prevSpanWithDepth.depth > maxDepth) {
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

    // Flatten tree for rendering (depth-first traversal)
    const flattenTree = (nodes: SpanWithDepth[]): SpanWithDepth[] => {
      const result: SpanWithDepth[] = [];
      nodes.forEach(node => {
        result.push(node);
        result.push(...flattenTree(node.children));
      });
      return result;
    };

    return {
      spanTree: rootSpans,
      minTime: min,
      timeRange: range,
    };
  }, [trace]);

  // Filter spans based on collapsed state
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

  const visibleSpans = useMemo(() => {
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
    const time = new Date(startTime).getTime();
    return ((time - minTime) / timeRange) * 100;
  };

  const calculateWidth = (startTime: string, endTime: string): number => {
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const duration = end - start;
    return (duration / timeRange) * 100;
  };

  return (
    <Box className={classes.container}>
      <Typography variant="subtitle2" gutterBottom>
        Trace ID: {trace.traceId}
      </Typography>
      <Box className={classes.timeline}>
        {visibleSpans.map((span) => {
          const left = calculatePosition(span.startTime);
          const width = Math.max(calculateWidth(span.startTime, span.endTime), 0.5); // Minimum width
          const color = getSpanColor(span.name, span.depth);
          const indent = span.depth * 20;
          const hasChildren = span.children.length > 0;
          const isCollapsed = collapsedSpans.has(span.spanId);

          return (
            <Box key={span.spanId} className={classes.spanRow}>
              <Box className={classes.spanLabel} style={{ paddingLeft: `${indent}px` }}>
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
                <Box
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                  title={span.name}
                >
                  {span.name}
                </Box>
              </Box>
              <Box className={classes.spanBarContainer}>
                <Tooltip
                  title={
                    <Box className={classes.tooltipContent}>
                      <Box className={classes.tooltipRow}>
                        <Typography variant="h6" component="span" className={classes.tooltipLabel}>
                          {span.name}
                        </Typography>
                        <Divider />
                      </Box>
                      <Box className={classes.tooltipRow}>
                        <Typography variant="caption" component="span" className={classes.tooltipLabel}>
                          Span ID:
                        </Typography>
                        <Typography variant="caption">{span.spanId}</Typography>
                      </Box>
                      <Box className={classes.tooltipRow}>
                        <Typography variant="caption" component="span" className={classes.tooltipLabel}>
                          Start Time:
                        </Typography>
                        <Typography variant="caption">{formatTime(span.startTime)}</Typography>
                      </Box>
                      <Box className={classes.tooltipRow}>
                        <Typography variant="caption" component="span" className={classes.tooltipLabel}>
                          End Time:
                        </Typography>
                        <Typography variant="caption">{formatTime(span.endTime)}</Typography>
                      </Box>
                      <Box className={classes.tooltipRow}>
                        <Typography variant="caption" component="span" className={classes.tooltipLabel}>
                          Duration:
                        </Typography>
                        <Typography variant="caption">{formatDuration(span.durationInNanos)}</Typography>
                      </Box>
                    </Box>
                  }
                  arrow
                  placement="top"
                >
                  <Box
                    className={classes.spanBar}
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      backgroundColor: color,
                    }}
                  >
                    {width > 5 && formatDuration(span.durationInNanos)}
                  </Box>
                </Tooltip>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
