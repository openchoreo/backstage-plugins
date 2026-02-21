import { useMemo } from 'react';
import {
  deepCompareObjects,
  type Change,
} from '@openchoreo/backstage-plugin-react';
import type { ModelsWorkload } from '@openchoreo/backstage-plugin-common';

/**
 * Workload changes grouped by section
 */
export interface WorkloadChanges {
  /** Changes in container (env vars, files, images, etc.) */
  container: Change[];
  /** Changes in endpoints */
  endpoints: Change[];
  /** Changes in connections */
  connections: Change[];
  /** Total number of changes */
  total: number;
  /** Whether there are any changes */
  hasChanges: boolean;
}

/**
 * Hook for detecting changes between initial and current workload data.
 * Compares containers, endpoints, and connections separately.
 *
 * @param initialWorkload - The original workload data from the server
 * @param currentWorkload - The current modified workload data
 * @returns WorkloadChanges object with grouped changes and summary
 */
export function useWorkloadChanges(
  initialWorkload: ModelsWorkload | null,
  currentWorkload: ModelsWorkload | null,
): WorkloadChanges {
  return useMemo(() => {
    // Compare container (single container, wrapped for deepCompareObjects)
    const containerChanges = deepCompareObjects(
      initialWorkload?.container || {},
      currentWorkload?.container || {},
    );

    // Compare endpoints
    const endpointChanges = deepCompareObjects(
      initialWorkload?.endpoints || {},
      currentWorkload?.endpoints || {},
    );

    // Compare connections
    const connectionChanges = deepCompareObjects(
      initialWorkload?.connections || {},
      currentWorkload?.connections || {},
    );

    const total =
      containerChanges.length +
      endpointChanges.length +
      connectionChanges.length;

    return {
      container: containerChanges,
      endpoints: endpointChanges,
      connections: connectionChanges,
      total,
      hasChanges: total > 0,
    };
  }, [initialWorkload, currentWorkload]);
}
