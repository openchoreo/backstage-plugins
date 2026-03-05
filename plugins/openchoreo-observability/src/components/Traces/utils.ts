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

export function calculateTimeRange(timeRange: string): {
  startTime: string;
  endTime: string;
} {
  const now = new Date();
  const endTime = now.toISOString();

  let startTime: Date;

  switch (timeRange) {
    case '10m':
      startTime = new Date(now.getTime() - 10 * 60 * 1000);
      break;
    case '30m':
      startTime = new Date(now.getTime() - 30 * 60 * 1000);
      break;
    case '1h':
      startTime = new Date(now.getTime() - 60 * 60 * 1000);
      break;
    case '24h':
      startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '14d':
      startTime = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      break;
    default:
      startTime = new Date(now.getTime() - 60 * 60 * 1000);
  }

  return {
    startTime: startTime.toISOString(),
    endTime,
  };
}
