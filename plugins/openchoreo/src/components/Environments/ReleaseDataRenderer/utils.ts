import { HealthStatus } from './types';
import { ReleaseInfoStyleClasses } from './styles';

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

/**
 * Get tab indicator status based on health status.
 */
export function getHealthStatusForTab(
  healthStatus?: HealthStatus,
): 'success' | 'warning' | 'error' | 'default' | undefined {
  switch (healthStatus) {
    case 'Healthy':
      return 'success';
    case 'Progressing':
    case 'Unknown':
      return 'warning';
    case 'Degraded':
      return 'error';
    case 'Suspended':
      return 'warning';
    default:
      return 'default';
  }
}

/**
 * Get chip CSS class based on health status.
 */
export function getHealthChipClass(
  healthStatus: string | undefined,
  classes: ReleaseInfoStyleClasses,
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
