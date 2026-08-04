import { DoraClassification } from '../../types';

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

export const CLASSIFICATION_COLORS: Record<
  DoraClassification,
  { background: string; text: string }
> = {
  Elite: { background: '#e6f4ea', text: '#1e7e34' },
  High: { background: '#e3f2fd', text: '#0d5aa7' },
  Medium: { background: '#fff3e0', text: '#b26a00' },
  Low: { background: '#fdecea', text: '#c62828' },
  Unknown: { background: '#f5f5f5', text: '#616161' },
};

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
