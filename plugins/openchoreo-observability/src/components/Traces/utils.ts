import { SpanStatus } from '../../types';

export function parseRfc3339NanoToNanoseconds(rfc3339Nano: string): number {
  // Split timestamp into base and fractional parts and return nanoseconds
  const [base, fractional] = rfc3339Nano.replace('Z', '').split('.');
  const milliseconds = new Date(`${base}Z`).getTime();
  const nanos = fractional
    ? parseInt(fractional.padEnd(9, '0').slice(0, 9), 10)
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
  return rfc3339Nano.endsWith('Z') ? rfc3339Nano : `${rfc3339Nano}Z`;
}

/**
 * Format an RFC 3339 (nano-precision) timestamp in the viewer's local
 * timezone, matching how the runtime logs view renders timestamps. Falls back
 * to the raw value when it cannot be parsed, so we never render "Invalid Date".
 */
export function formatTimestamp(rfc3339Nano: string): string {
  if (!rfc3339Nano) return '';

  // Parse through the nano-aware helper: some browsers (notably Safari)
  // cannot parse 9-digit fractional seconds with `new Date(str)` directly.
  const milliseconds = Math.floor(
    parseRfc3339NanoToNanoseconds(rfc3339Nano) / 1_000_000,
  );
  const date = new Date(milliseconds);

  return Number.isNaN(date.getTime()) ? rfc3339Nano : date.toLocaleString();
}

/** The OTel status code (`ok` | `error` | `unset`) of a span, if present. */
export function getSpanStatusCode(status?: SpanStatus): string | undefined {
  return status?.code;
}

/** Whether a span carries an error status. */
export function isSpanError(status?: SpanStatus): boolean {
  return status?.code === 'error';
}
