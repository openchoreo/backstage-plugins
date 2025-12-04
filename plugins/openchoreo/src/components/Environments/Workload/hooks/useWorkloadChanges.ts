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
  /** Changes in containers (env vars, files, images, etc.) */
  containers: Change[];
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
    // Compare containers
    const containerChanges = deepCompareObjects(
      initialWorkload?.containers || {},
      currentWorkload?.containers || {},
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
      containers: containerChanges,
      endpoints: endpointChanges,
      connections: connectionChanges,
      total,
      hasChanges: total > 0,
    };
  }, [initialWorkload, currentWorkload]);
}

/**
 * Get changes for a specific container
 */
export function getContainerChanges(
  changes: WorkloadChanges,
  containerName: string,
): Change[] {
  return changes.containers.filter(
    c =>
      c.path.startsWith(containerName) ||
      c.path.startsWith(`${containerName}.`),
  );
}

/**
 * Check if a specific container has changes
 */
export function hasContainerChanges(
  changes: WorkloadChanges,
  containerName: string,
): boolean {
  return getContainerChanges(changes, containerName).length > 0;
}
