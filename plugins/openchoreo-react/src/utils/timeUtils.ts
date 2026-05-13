/**
 * Formats a date string into a relative time format (e.g., "5 minutes ago")
 * @param dateString - The date string to format
 * @returns A human-readable relative time string
 */
export const formatRelativeTime = (dateString: string): string => {
  const now = new Date();
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return `${diffInSeconds} seconds ago`;
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths} ${diffInMonths === 1 ? 'month' : 'months'} ago`;
  }

  const diffInYears = Math.floor(diffInMonths / 12);
  return `${diffInYears} ${diffInYears === 1 ? 'year' : 'years'} ago`;
};

/**
 * Calculates start and end time ISO strings for a preset range (e.g. '10m',
 * '7d', '30d') or a user-picked `'custom'` window passed via `custom`.
 */
export function calculateTimeRange(
  timeRange: string,
  custom?: { startTime?: string; endTime?: string },
): {
  startTime: string;
  endTime: string;
} {
  const now = new Date();
  const endTime = now.toISOString();

  if (timeRange === 'custom') {
    return {
      startTime:
        custom?.startTime ??
        new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
      endTime: custom?.endTime ?? endTime,
    };
  }

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
    case '30d':
      startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      startTime = new Date(now.getTime() - 60 * 60 * 1000); // Default to 1 hour
  }

  return {
    startTime: startTime.toISOString(),
    endTime,
  };
}

/**
 * Picks the smallest preset range whose duration covers `ageMs` (e.g. an
 * alert's age), so a linked view opens with a window that includes the event.
 * Falls back to the widest preset when nothing is large enough.
 */
export function pickRangeForAge(ageMs: number): string {
  const presets: Array<{ value: string; ms: number }> = [
    { value: '10m', ms: 10 * 60 * 1000 },
    { value: '30m', ms: 30 * 60 * 1000 },
    { value: '1h', ms: 60 * 60 * 1000 },
    { value: '24h', ms: 24 * 60 * 60 * 1000 },
    { value: '7d', ms: 7 * 24 * 60 * 60 * 1000 },
    { value: '14d', ms: 14 * 24 * 60 * 60 * 1000 },
  ];
  const match = presets.find(p => p.ms >= ageMs);
  return match ? match.value : presets[presets.length - 1].value;
}
