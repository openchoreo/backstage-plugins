import type { EnvVarStatus, EnvVarWithStatus } from './envVarUtils';
import type { FileVarStatus, FileVarWithStatus } from './fileVarUtils';

/**
 * Counts for each override status category.
 */
export interface StatusCounts {
  overridden: number;
  new: number;
  inherited: number;
}

/**
 * Items grouped by their override status.
 */
export interface GroupedItems<T> {
  overridden: T[];
  new: T[];
  inherited: T[];
}

type ItemWithStatus = EnvVarWithStatus | FileVarWithStatus;
type StatusType = EnvVarStatus | FileVarStatus;

/**
 * Groups items by their status (overridden, new, inherited).
 * Maintains the original actualIndex for each item.
 *
 * @param items - Array of items with status metadata
 * @returns Items grouped by status
 */
export function groupByStatus<T extends ItemWithStatus>(
  items: T[],
): GroupedItems<T> {
  const result: GroupedItems<T> = {
    overridden: [],
    new: [],
    inherited: [],
  };

  for (const item of items) {
    const status = item.status as StatusType;
    if (status === 'overridden') {
      result.overridden.push(item);
    } else if (status === 'new') {
      result.new.push(item);
    } else {
      result.inherited.push(item);
    }
  }

  return result;
}

/**
 * Calculates counts for each status category.
 *
 * @param items - Array of items with status metadata
 * @returns Counts for overridden, new, and inherited items
 */
export function getStatusCounts<T extends ItemWithStatus>(
  items: T[],
): StatusCounts {
  const counts: StatusCounts = {
    overridden: 0,
    new: 0,
    inherited: 0,
  };

  for (const item of items) {
    const status = item.status as StatusType;
    if (status === 'overridden') {
      counts.overridden++;
    } else if (status === 'new') {
      counts.new++;
    } else {
      counts.inherited++;
    }
  }

  return counts;
}

/**
 * Checks if there are any items in any status category.
 *
 * @param counts - Status counts
 * @returns True if any category has items
 */
export function hasAnyItems(counts: StatusCounts): boolean {
  return counts.overridden > 0 || counts.new > 0 || counts.inherited > 0;
}

/**
 * Gets the total count of all items.
 *
 * @param counts - Status counts
 * @returns Total count
 */
export function getTotalCount(counts: StatusCounts): number {
  return counts.overridden + counts.new + counts.inherited;
}
