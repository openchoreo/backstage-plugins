/**
 * Calculate start and end times based on a time range string.
 * Used for filtering logs by time window.
 */
export function calculateTimeRange(timeRange: string): {
  startTime: string;
  endTime: string;
} {
  const now = new Date();
  const endTime = now.toISOString();

  const timeRangeMs: Record<string, number> = {
    '10m': 10 * 60 * 1000,
    '30m': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '14d': 14 * 24 * 60 * 60 * 1000,
  };

  const msAgo = timeRangeMs[timeRange] || timeRangeMs['1h'];
  const startTime = new Date(now.getTime() - msAgo);

  return {
    startTime: startTime.toISOString(),
    endTime,
  };
}
