import { useMemo } from 'react';
import {
  deepCompareObjects,
  type Change,
} from '@openchoreo/backstage-plugin-react';
import type {
  ModelsWorkload,
  Dependency,
} from '@openchoreo/backstage-plugin-common';

/**
 * Workload changes grouped by section
 */
export interface WorkloadChanges {
  /** Changes in container (env vars, files, images, etc.) */
  container: Change[];
  /** Changes in endpoints */
  endpoints: Change[];
  /** Changes in dependencies */
  dependencies: Change[];
  /** Total number of changes */
  total: number;
  /** Whether there are any changes */
  hasChanges: boolean;
}

/**
 * Build a human-readable label for a dependency.
 */
function dependencyLabel(dep: Dependency): string {
  const parts: string[] = [];
  if (dep.project) parts.push(dep.project);
  if (dep.component) parts.push(dep.component);
  const target = parts.join('/') || 'unknown';
  return dep.name ? `${target}/${dep.name}` : target;
}

/**
 * Compare dependency arrays and produce changes with readable labels
 * instead of raw array indices.
 */
function compareDependencies(
  initial: Dependency[],
  current: Dependency[],
): Change[] {
  const changes: Change[] = [];
  const maxLen = Math.max(initial.length, current.length);

  for (let i = 0; i < maxLen; i++) {
    const oldDep = initial[i];
    const newDep = current[i];

    if (!oldDep && newDep) {
      // New dependency added
      changes.push({
        path: dependencyLabel(newDep),
        type: 'new',
        newValue: 'Added',
      });
    } else if (oldDep && !newDep) {
      // Dependency removed
      changes.push({
        path: dependencyLabel(oldDep),
        type: 'removed',
        oldValue: 'Removed',
      });
    } else if (oldDep && newDep) {
      // Compare fields of an existing dependency
      const fieldDiffs = deepCompareObjects(oldDep, newDep);
      if (fieldDiffs.length > 0) {
        const label = dependencyLabel(newDep);
        for (const diff of fieldDiffs) {
          changes.push({ ...diff, path: `${label}.${diff.path}` });
        }
      }
    }
  }

  return changes;
}

/**
 * Hook for detecting changes between initial and current workload data.
 * Compares containers, endpoints, and dependencies separately.
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

    // Compare dependencies with human-readable labels
    const dependencyChanges = compareDependencies(
      initialWorkload?.dependencies?.endpoints || [],
      currentWorkload?.dependencies?.endpoints || [],
    );

    const total =
      containerChanges.length +
      endpointChanges.length +
      dependencyChanges.length;

    return {
      container: containerChanges,
      endpoints: endpointChanges,
      dependencies: dependencyChanges,
      total,
      hasChanges: total > 0,
    };
  }, [initialWorkload, currentWorkload]);
}
