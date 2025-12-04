import { useMemo } from 'react';
import {
  Change,
  deepCompareObjects,
  getChangeStats,
  ChangeStats,
} from '../utils/changeDetection';

/**
 * Result of the useChangeDetection hook
 */
export interface UseChangeDetectionResult {
  /** List of all detected changes */
  changes: Change[];
  /** Whether there are any changes */
  hasChanges: boolean;
  /** Total number of changes */
  changeCount: number;
  /** Detailed statistics about changes */
  stats: ChangeStats;
}

/**
 * Hook for detecting changes between initial and current data.
 * Uses memoization to avoid unnecessary recalculations.
 *
 * @param initialData - The original/baseline data
 * @param currentData - The current/modified data
 * @returns Object containing changes array and helper properties
 *
 * @example
 * ```tsx
 * const { changes, hasChanges, changeCount } = useChangeDetection(
 *   initialFormData,
 *   currentFormData
 * );
 *
 * if (hasChanges) {
 *   console.log(`${changeCount} changes detected`);
 * }
 * ```
 */
export function useChangeDetection<T>(
  initialData: T,
  currentData: T,
): UseChangeDetectionResult {
  return useMemo(() => {
    const changes = deepCompareObjects(initialData, currentData);
    const stats = getChangeStats(changes);

    return {
      changes,
      hasChanges: changes.length > 0,
      changeCount: changes.length,
      stats,
    };
  }, [initialData, currentData]);
}
