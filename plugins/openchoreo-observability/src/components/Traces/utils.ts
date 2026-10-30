import { SpanStatus } from '../../types';

const RFC3339_NANO_PATTERN =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})?$/;

export function parseRfc3339NanoToNanoseconds(rfc3339Nano: string): number {
  const match = RFC3339_NANO_PATTERN.exec(rfc3339Nano);
  if (!match) return Number.NaN;

  const [, dateTime, fractional = '', offset = 'Z'] = match;

  // Parse the second-precision base together with its offset so Date applies
  // the numeric offset correctly. The fraction is added separately as nanos.
  const milliseconds = new Date(`${dateTime}${offset}`).getTime();
  if (Number.isNaN(milliseconds)) return Number.NaN;

  const nanos = fractional
    ? Number.parseInt(fractional.padEnd(9, '0').slice(0, 9), 10)
    : 0;

  return milliseconds * 1_000_000 + nanos;
}

export function nanosecondsToRfc3339Nano(nanoseconds: number): string {
  const milliseconds = Math.floor(nanoseconds / 1_000_000);
  const remainingNanos = nanoseconds % 1_000_000;

  const isoString = new Date(milliseconds).toISOString();
  const nanoPart = remainingNanos.toString().padStart(6, '0');

  return isoString.replace(/\.\d{3}Z$/, `.${nanoPart}000Z`);
}

export function formatDuration(nanoseconds: number): string {
  if (nanoseconds < 1_000) return `${nanoseconds}ns`;
  if (nanoseconds < 1_000_000) return `${(nanoseconds / 1_000).toFixed(3)}μs`;
  if (nanoseconds < 1_000_000_000)
    return `${(nanoseconds / 1_000_000).toFixed(3)}ms`;
  return `${(nanoseconds / 1_000_000_000).toFixed(3)}s`;
}

export function formatTime(nanoseconds: number): string {
  return new Date(Math.floor(nanoseconds / 1_000_000)).toISOString();
}

export function formatTimeFromString(rfc3339Nano: string): string {
  return /(?:Z|[+-]\d{2}:\d{2})$/i.test(rfc3339Nano)
    ? rfc3339Nano
    : `${rfc3339Nano}Z`;
}

export interface FormatTimestampOptions {
  fractionalSeconds?: boolean;
}

/**
 * Format an RFC 3339 (nano-precision) timestamp in the viewer's local
 * timezone, matching how the runtime logs view renders timestamps. Falls back
 * to the raw value when it cannot be parsed, so we never render "Invalid Date".
 */
export function formatTimestamp(
  rfc3339Nano: string,
  options: FormatTimestampOptions = {},
): string {
  if (!rfc3339Nano) return '';

  // Parse through the nano-aware helper: some browsers (notably Safari)
  // cannot parse 9-digit fractional seconds with `new Date(str)` directly.
  const milliseconds = Math.floor(
    parseRfc3339NanoToNanoseconds(rfc3339Nano) / 1_000_000,
  );
  const date = new Date(milliseconds);

  if (Number.isNaN(date.getTime())) return rfc3339Nano;

  return date.toLocaleString(
    undefined,
    options.fractionalSeconds ? { fractionalSecondDigits: 3 } : undefined,
  );
}

/** The OTel status code (`ok` | `error` | `unset`) of a span, if present. */
export function getSpanStatusCode(status?: SpanStatus): string | undefined {
  return status?.code;
}

/** Whether a span carries an error status. */
export function isSpanError(status?: SpanStatus): boolean {
  return status?.code === 'error';
}
