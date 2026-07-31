import { TIME_RANGE_OPTIONS } from '@openchoreo/backstage-plugin-react';

const DEFAULT_TIME_RANGE = '10m';
const VALID_TIME_RANGES = new Set(TIME_RANGE_OPTIONS.map(o => o.value));

const isValidIso = (value: string | null): value is string =>
  !!value && !Number.isNaN(new Date(value).getTime());

export interface UrlTimeRange {
  timeRange: string;
  customStartTime?: string;
  customEndTime?: string;
}

/**
 * Parse `timeRange` + `from`/`to` query params with validation.
 * If `timeRange === 'custom'` but `from`/`to` are missing or unparseable,
 * falls back to `defaultTimeRange`.
 *
 * `defaultTimeRange` lets a view pick its own landing window — e.g. Cost
 * Insights defaults to a day-scale window because OpenCost cost allocation is
 * day-grained and a sub-hour window yields an empty accumulation.
 */
export function parseUrlTimeRange(
  searchParams: URLSearchParams,
  defaultTimeRange: string = DEFAULT_TIME_RANGE,
): UrlTimeRange {
  const fallback = VALID_TIME_RANGES.has(defaultTimeRange)
    ? defaultTimeRange
    : DEFAULT_TIME_RANGE;
  const raw = searchParams.get('timeRange') || fallback;
  let timeRange = VALID_TIME_RANGES.has(raw) ? raw : fallback;
  let customStartTime: string | undefined;
  let customEndTime: string | undefined;
  if (timeRange === 'custom') {
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    if (isValidIso(from) && isValidIso(to)) {
      customStartTime = from;
      customEndTime = to;
    } else {
      timeRange = fallback;
    }
  }
  return { timeRange, customStartTime, customEndTime };
}

/**
 * Apply a partial time-range update to a URLSearchParams instance in place.
 * Switching away from `custom` clears stale `from`/`to`. The `defaultTimeRange`
 * preset is elided from the URL so it stays clean — pass the same value the
 * view gives {@link parseUrlTimeRange} so the two stay in sync.
 */
export function writeUrlTimeRange(
  params: URLSearchParams,
  next: Partial<UrlTimeRange>,
  defaultTimeRange: string = DEFAULT_TIME_RANGE,
): void {
  if (next.timeRange !== undefined) {
    if (next.timeRange === defaultTimeRange) {
      params.delete('timeRange');
    } else {
      params.set('timeRange', next.timeRange);
    }
    if (next.timeRange !== 'custom') {
      params.delete('from');
      params.delete('to');
    }
  }
  if (next.customStartTime !== undefined) {
    if (next.customStartTime) {
      params.set('from', next.customStartTime);
    } else {
      params.delete('from');
    }
  }
  if (next.customEndTime !== undefined) {
    if (next.customEndTime) {
      params.set('to', next.customEndTime);
    } else {
      params.delete('to');
    }
  }
}
