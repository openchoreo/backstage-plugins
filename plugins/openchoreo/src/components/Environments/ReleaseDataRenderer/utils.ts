import { StyleClasses } from './styles';
import { HealthStatus } from './types';

/**
 * Get the appropriate chip class based on health status.
 */
export function getHealthChipClass(
  healthStatus: HealthStatus | undefined,
  classes: StyleClasses,
): string {
  switch (healthStatus) {
    case 'Healthy':
      return classes.healthyChip;
    case 'Progressing':
      return classes.progressingChip;
    case 'Degraded':
      return classes.degradedChip;
    case 'Suspended':
      return classes.suspendedChip;
    default:
      return classes.unknownChip;
  }
}

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
