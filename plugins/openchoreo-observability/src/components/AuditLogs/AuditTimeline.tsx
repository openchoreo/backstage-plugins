import { useMemo } from 'react';
import { Box, Typography } from '@material-ui/core';
import { useTheme } from '@material-ui/core/styles';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Skeleton } from '@openchoreo/backstage-design-system';
import { useAuditTimelineStyles, useResultColor } from './styles';
import { AUDIT_RESULTS, AuditLogTimeline } from './types';
import { bucketTick, fullTime } from './format';

export interface AuditTimelineProps {
  timeline?: AuditLogTimeline;
  loading: boolean;
  /** Narrows the query to one bucket when a bar is clicked. */
  onSelectRange?: (startTime: string, endTime: string) => void;
}

/** Bucket widths as milliseconds, for turning `interval` into a bar's end time. */
const UNIT_MS: Record<string, number> = {
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
};

/**
 * Records a bucket reports but does not break down. Deliberately neutral: an
 * absence of information, not an outcome of its own.
 */
function useUnattributedColor(): string {
  return useTheme().palette.grey[500];
}

/** `15m` → 900000. Returns 0 for a width this client does not recognise. */
export function intervalToMs(interval: string): number {
  const match = /^([1-9][0-9]*)([mhdw])$/.exec(interval);
  if (!match) return 0;
  return Number(match[1]) * (UNIT_MS[match[2]] ?? 0);
}

export interface TimelinePoint {
  startTime: string;
  label: string;
  total: number;
  /** Records the breakdown does not account for, so the bar still has its height. */
  unattributed: number;
  success: number;
  failure: number;
  denied: number;
  unauthenticated: number;
}

/**
 * The hovered bucket.
 *
 * Every outcome is listed whichever segment the pointer hit: a stacked bar
 * reports one payload entry per segment, and an outcome missing from the
 * tooltip reads as unknown rather than as none.
 */
export const AuditTimelineTooltip = ({
  bucket,
}: {
  bucket?: TimelinePoint;
}) => {
  const classes = useAuditTimelineStyles();
  const colors = useResultColor();
  const unattributedColor = useUnattributedColor();

  if (!bucket) return null;

  return (
    <Box className={classes.tooltip}>
      <div className={classes.tooltipTime}>{fullTime(bucket.startTime)}</div>
      {AUDIT_RESULTS.map(result => (
        <div key={result.id} className={classes.tooltipRow}>
          <span
            className={classes.tooltipSwatch}
            style={{ backgroundColor: colors[result.id] }}
            aria-hidden="true"
          />
          <span className={classes.tooltipLabel}>{result.label}</span>
          <span className={classes.tooltipCount}>
            {bucket[result.id].toLocaleString()}
          </span>
        </div>
      ))}
      {bucket.unattributed > 0 && (
        <div className={classes.tooltipRow}>
          <span
            className={classes.tooltipSwatch}
            style={{ backgroundColor: unattributedColor }}
            aria-hidden="true"
          />
          <span className={classes.tooltipLabel}>Not broken down</span>
          <span className={classes.tooltipCount}>
            {bucket.unattributed.toLocaleString()}
          </span>
        </div>
      )}
      <div className={`${classes.tooltipRow} ${classes.tooltipTotal}`}>
        <span className={classes.tooltipLabel}>Total</span>
        <span className={classes.tooltipCount}>
          {bucket.total.toLocaleString()}
        </span>
      </div>
    </Box>
  );
};

/**
 * Activity over the window, stacked by outcome.
 *
 * Loaded lazily by the page: recharts is a large dependency, and a page opened
 * to read records should not pay for a chart that may stay collapsed.
 */
export const AuditTimeline = ({
  timeline,
  loading,
  onSelectRange,
}: AuditTimelineProps) => {
  const classes = useAuditTimelineStyles();
  const theme = useTheme();
  const colors = useResultColor();
  const unattributedColor = useUnattributedColor();

  const spanMs = useMemo(() => {
    if (!timeline || timeline.buckets.length === 0) return 0;
    const first = new Date(timeline.buckets[0].startTime).getTime();
    const last = new Date(
      timeline.buckets[timeline.buckets.length - 1].startTime,
    ).getTime();
    return last - first;
  }, [timeline]);

  const data = useMemo<TimelinePoint[]>(
    () =>
      (timeline?.buckets ?? []).map(bucket => {
        // An absent key means zero, so every result this client knows about is
        // rendered rather than only the ones present in the bucket.
        const counted = {
          success: bucket.counts?.success ?? 0,
          failure: bucket.counts?.failure ?? 0,
          denied: bucket.counts?.denied ?? 0,
          unauthenticated: bucket.counts?.unauthenticated ?? 0,
        };
        // `total` is carried separately from `counts` so a bucket whose
        // breakdown the backend could not produce — or which holds a result
        // this client predates — still reports its height.
        const attributed = Object.values(counted).reduce(
          (sum, value) => sum + value,
          0,
        );
        return {
          startTime: bucket.startTime,
          label: bucketTick(bucket.startTime, spanMs),
          total: bucket.total,
          unattributed: Math.max(0, bucket.total - attributed),
          ...counted,
        };
      }),
    [spanMs, timeline],
  );

  return (
    <>
      {loading && <Skeleton variant="rect" height={168} />}

      {!loading && !timeline && (
        <Typography variant="body2" className={classes.unknown}>
          This deployment does not report a timeline, so activity over the
          window is unknown. That is not the same as nothing happening. The
          records below are unaffected.
        </Typography>
      )}

      {!loading && timeline && (
        <Box className={classes.chartBox}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
              barCategoryGap={1}
              onClick={state => {
                if (!onSelectRange) return;
                // recharts reports the clicked category by index, so the bucket
                // comes back out of the same array the chart was given.
                const index = Number(state?.activeIndex);
                const point = Number.isInteger(index) ? data[index] : undefined;
                // A width this client cannot parse is a width it must not
                // invent: the server may answer in a unit added later.
                const width = intervalToMs(timeline.interval);
                if (!point || !width) return;
                const start = new Date(point.startTime);
                onSelectRange(
                  start.toISOString(),
                  new Date(start.getTime() + width).toISOString(),
                );
              }}
            >
              <CartesianGrid vertical={false} stroke={theme.palette.divider} />
              {/* Keyed on the bucket's start because it is unique. A formatted
                  label repeats across a day's buckets once the window passes
                  two days, and recharts cannot then tell which bucket the
                  pointer is over. */}
              <XAxis
                dataKey="startTime"
                tickFormatter={value => bucketTick(String(value), spanMs)}
                tick={{ fontSize: 10, fill: theme.palette.text.disabled }}
                interval="preserveStartEnd"
                minTickGap={24}
                stroke={theme.palette.divider}
              />
              <YAxis
                allowDecimals={false}
                width={36}
                tick={{ fontSize: 10, fill: theme.palette.text.disabled }}
                stroke={theme.palette.divider}
              />
              <ChartTooltip
                // The whole category band, so a bucket reads the same wherever
                // in its column the pointer is — `maxBarSize` leaves the bar
                // narrower than the band it sits in.
                cursor={{ fill: theme.palette.action.hover }}
                content={props => (
                  <AuditTimelineTooltip
                    bucket={
                      props.payload?.[0]?.payload as TimelinePoint | undefined
                    }
                  />
                )}
              />
              {AUDIT_RESULTS.map(result => (
                <Bar
                  key={result.id}
                  dataKey={result.id}
                  name={result.label}
                  stackId="result"
                  fill={colors[result.id]}
                  maxBarSize={28}
                />
              ))}
              {/* Carries whatever the breakdown does not account for, so the
                  bar's height is always the bucket's total. */}
              <Bar
                dataKey="unattributed"
                name="Not broken down"
                stackId="result"
                fill={unattributedColor}
                maxBarSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      )}
    </>
  );
};

export default AuditTimeline;
