import { TIME_RANGE_OPTIONS } from '../types';

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
 * falls back to the default preset.
 */
export function parseUrlTimeRange(searchParams: URLSearchParams): UrlTimeRange {
  const raw = searchParams.get('timeRange') || DEFAULT_TIME_RANGE;
  let timeRange = VALID_TIME_RANGES.has(raw) ? raw : DEFAULT_TIME_RANGE;
  let customStartTime: string | undefined;
  let customEndTime: string | undefined;
  if (timeRange === 'custom') {
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    if (isValidIso(from) && isValidIso(to)) {
      customStartTime = from;
      customEndTime = to;
    } else {
      timeRange = DEFAULT_TIME_RANGE;
    }
  }
  return { timeRange, customStartTime, customEndTime };
}

/**
 * Apply a partial time-range update to a URLSearchParams instance in place.
 * Switching away from `custom` clears stale `from`/`to`. Default preset is
 * elided from the URL so it stays clean.
 */
export function writeUrlTimeRange(
  params: URLSearchParams,
  next: Partial<UrlTimeRange>,
): void {
  if (next.timeRange !== undefined) {
    if (next.timeRange === DEFAULT_TIME_RANGE) {
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
