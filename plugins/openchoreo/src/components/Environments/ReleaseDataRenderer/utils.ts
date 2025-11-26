/**
 * Format an ISO timestamp to a locale string.
 */
export function formatTimestamp(timestamp?: string): string {
  if (!timestamp) return 'N/A';
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return timestamp;
  }
}
