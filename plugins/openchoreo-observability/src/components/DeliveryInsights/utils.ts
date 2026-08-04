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
