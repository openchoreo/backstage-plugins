import { Theme, alpha } from '@material-ui/core/styles';
import { PaletteColor } from '@material-ui/core/styles/createPalette';
import {
  DoraClassification,
  DoraDataAvailability,
  DoraGranularity,
} from '../../types';

/** Formats a millisecond duration as a compact human string (e.g. 45m, 3.2h, 2.1d). */
export function formatDurationMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) {
    return '—';
  }
  const minutes = ms / 60000;
  if (minutes < 1) {
    return '<1m';
  }
  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }
  const hours = minutes / 60;
  if (hours < 24) {
    return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)}h`;
  }
  const days = hours / 24;
  return `${days < 10 ? days.toFixed(1) : Math.round(days)}d`;
}

export function formatPercent(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) {
    return '—';
  }
  return `${(rate * 100).toFixed(1)}%`;
}

export interface ClassificationColor {
  background: string;
  text: string;
}

/**
 * Chip colors for a DORA classification, derived from the theme so the tiles
 * and the breakdown table stay legible in both the light and the dark theme.
 * The background is the palette color at low opacity over whatever surface the
 * chip sits on; the label takes the shade that contrasts with it.
 */
export function classificationColors(
  theme: Theme,
): Record<DoraClassification, ClassificationColor> {
  const dark = theme.palette.type === 'dark';
  const tint = (color: PaletteColor): ClassificationColor => ({
    background: alpha(color.main, dark ? 0.24 : 0.14),
    text: dark ? color.light : color.dark,
  });

  return {
    Elite: tint(theme.palette.success),
    High: tint(theme.palette.info),
    Medium: tint(theme.palette.warning),
    Low: tint(theme.palette.error),
    Unknown: {
      background: alpha(theme.palette.text.secondary, dark ? 0.24 : 0.14),
      text: theme.palette.text.secondary,
    },
  };
}

/**
 * Color for a period-over-period delta: green when the change is an
 * improvement for that metric, red when it is a regression.
 */
export function deltaColor(theme: Theme, isImprovement: boolean): string {
  return isImprovement ? theme.palette.success.main : theme.palette.error.main;
}

/**
 * Whether a positive delta is an improvement for this metric: more deployments is
 * good; longer lead time, higher failure rate, and slower recovery are not.
 */
export function isPositiveDeltaGood(
  metric: 'deploymentFrequency' | 'leadTime' | 'changeFailureRate' | 'mttr',
): boolean {
  return metric === 'deploymentFrequency';
}

export interface InsightsTimeRangeOption {
  label: string;
  days: number;
}

export const INSIGHTS_TIME_RANGES: InsightsTimeRangeOption[] = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '12mo', days: 365 },
];

/**
 * Aligns a sparse series onto a zero-filled reference series' buckets, inserting
 * `null` for buckets the sparse series omits.
 *
 * The observer zero-fills `deploymentFrequency` and `changeFailureRate` (one
 * entry per bucket in the window) but returns only buckets that have data for
 * `leadTime` and `mttr`. Plotted as-is on a categorical axis those omissions
 * vanish and the line bridges straight across an unmeasured period, implying
 * continuous coverage. Nulls make the gap render as a gap instead.
 */
export function fillSeriesGaps<K extends string>(
  buckets: ReadonlyArray<{ bucketStart: string }> | undefined,
  series:
    | ReadonlyArray<{ bucketStart: string } & Record<K, number>>
    | undefined,
  valueKeys: readonly K[],
): Array<Record<string, string | number | null>> {
  if (!series?.length) {
    return [];
  }
  const byBucket = new Map(series.map(point => [point.bucketStart, point]));
  // Without a reference window there is nothing to align to, so plot what we have.
  const slots = buckets?.length ? buckets : series;
  return slots.map(({ bucketStart }) => {
    const point = byBucket.get(bucketStart);
    const row: Record<string, string | number | null> = { bucketStart };
    for (const key of valueKeys) {
      row[key] = point ? point[key] : null;
    }
    return row;
  });
}

/**
 * `items.map(fn)` with at most `limit` calls in flight, preserving input order.
 *
 * The breakdown fans out one metrics request per child scope; at namespace level
 * that is every project plus every environment, which would otherwise hit the
 * observer all in the same tick.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const worker = async (): Promise<void> => {
    for (let index = cursor++; index < items.length; index = cursor++) {
      results[index] = await fn(items[index]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker),
  );
  return results;
}

/** Max concurrent breakdown metric requests (see `mapWithConcurrency`). */
/** A change-failure-rate bucket as the observer returns it. */
export interface CfrSeriesPoint {
  bucketStart: string;
  rate: number;
  failed: number;
  total: number;
}

/**
 * The change-failure-rate series is zero-filled, so a bucket that deployed
 * nothing still carries `rate: 0`. Plotted raw that reads as "nothing failed"
 * across a stretch where nothing shipped, which is the opposite of what it
 * means -- the tile, the breakdown table and the environment cards all show a
 * dash for the same bucket. Nulling it marks the bucket unmeasured so the chart
 * breaks the line instead of running it flat along the axis.
 */
export function nullUnmeasuredRates(
  points: readonly CfrSeriesPoint[] | undefined,
): Array<Record<string, string | number | null>> {
  return (points ?? []).map(point => ({
    ...point,
    rate: point.total > 0 ? point.rate : null,
  }));
}

/**
 * The same buckets dropped rather than nulled, for the tile's sparkline: it
 * takes `number[]` and scales on the min and max, so a null would skew the
 * baseline rather than register as absent.
 */
export function measuredRates(
  points: readonly CfrSeriesPoint[] | undefined,
): number[] {
  return (points ?? []).filter(p => p.total > 0).map(p => p.rate);
}

/**
 * The warning to show above the page when the observer cannot produce some of
 * these metrics, or null when it can produce them all.
 *
 * Both states below produce a successful, entirely plausible-looking empty
 * response, which is what makes them worth calling out: without this the page
 * is indistinguishable from one belonging to a team that has not deployed.
 */
export function dataAvailabilityWarning(
  availability: DoraDataAvailability | undefined,
): string | null {
  // Absent on an observer predating the field. Saying nothing is the safe
  // reading: it may well be collecting, and a wrong warning is worse than none.
  if (!availability) {
    return null;
  }
  if (availability.collecting === false) {
    return (
      'This observer is not collecting delivery data, so these metrics stay ' +
      'empty however much is deployed. Enable Delivery Insights on the ' +
      'observability plane ' +
      '(observer.featurePreview.deliveryInsights.enabled).'
    );
  }
  if (availability.deliveryEvents === false) {
    return (
      'Deployment frequency, lead time and change failure rate have no input ' +
      'on this observer: its logging backend cannot serve the delivery event ' +
      'sweep, which needs an adapter that filters events by reason across every ' +
      'namespace. Mean time to recovery is derived from incidents and is ' +
      'unaffected.'
    );
  }
  return null;
}

/** Approximate days per bucket, for deciding how many a window would produce. */
const GRANULARITY_DAYS: Record<DoraGranularity, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
};

/** Fewer buckets than this and the chart is a couple of columns, not a trend. */
const MIN_BUCKETS = 2;
/** More than this and the marks are too narrow to read in a card-width chart. */
const MAX_BUCKETS = 90;

/**
 * The granularities worth offering for a window, widest-first by bucket count.
 *
 * A window and a bucket size only make a chart together. A year of daily buckets
 * is 365 marks in a few hundred pixels, and a week of monthly buckets is one --
 * both are technically servable, which is why the pairing has to be constrained
 * here rather than left to the reader to avoid.
 */
export function granularitiesForRange(rangeDays: number): DoraGranularity[] {
  const allowed = (Object.keys(GRANULARITY_DAYS) as DoraGranularity[]).filter(
    granularity => {
      const buckets = rangeDays / GRANULARITY_DAYS[granularity];
      return buckets >= MIN_BUCKETS && buckets <= MAX_BUCKETS;
    },
  );
  // Never leave the control empty: an unusual window still needs a bucket size,
  // and the finest one is the least wrong for a short window.
  return allowed.length > 0 ? allowed : ['daily'];
}

/**
 * The granularity to use for a window: the current one where it still fits, and
 * otherwise the coarsest that does -- changing the range should not leave a
 * selection that cannot be charted.
 */
export function resolveGranularity(
  rangeDays: number,
  current: DoraGranularity,
): DoraGranularity {
  const allowed = granularitiesForRange(rangeDays);
  if (allowed.includes(current)) return current;
  return allowed[allowed.length - 1];
}

export const BREAKDOWN_CONCURRENCY = 6;

/** Short bucket label for chart axes: "Jul 7" (daily/weekly) or "Jul 2026" (monthly). */
export function formatBucketLabel(
  bucketStart: string,
  granularity: 'daily' | 'weekly' | 'monthly',
): string {
  const date = new Date(bucketStart);
  if (granularity === 'monthly') {
    return date.toLocaleDateString(undefined, {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
