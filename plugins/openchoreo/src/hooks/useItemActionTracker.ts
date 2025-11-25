import { useState, useCallback } from 'react';

/**
 * Hook for tracking per-item async operations.
 * Useful for showing loading states on individual items in a list.
 *
 * @example
 * const refreshTracker = useItemActionTracker<string>();
 *
 * // Execute an operation with automatic tracking
 * const handleRefresh = (envName: string) =>
 *   refreshTracker.withTracking(envName, async () => {
 *     await refetch();
 *   });
 *
 * // Check if an item has an active operation
 * refreshTracker.isActive('production'); // true/false
 *
 * // In JSX
 * <Button disabled={refreshTracker.isActive(item.name)}>
 *   {refreshTracker.isActive(item.name) ? 'Loading...' : 'Refresh'}
 * </Button>
 */
export function useItemActionTracker<T extends string>() {
  const [activeItems, setActiveItems] = useState<Set<T>>(new Set());

  const isActive = useCallback(
    (item: T) => activeItems.has(item),
    [activeItems],
  );

  const startAction = useCallback((item: T) => {
    setActiveItems(prev => new Set(prev).add(item));
  }, []);

  const endAction = useCallback((item: T) => {
    setActiveItems(prev => {
      const next = new Set(prev);
      next.delete(item);
      return next;
    });
  }, []);

  /**
   * Execute an async operation while tracking its progress for the given item.
   * Automatically handles starting and ending the tracking.
   */
  const withTracking = useCallback(
    async <R>(item: T, operation: () => Promise<R>): Promise<R> => {
      startAction(item);
      try {
        return await operation();
      } finally {
        endAction(item);
      }
    },
    [startAction, endAction],
  );

  return {
    /** Check if an item has an active operation */
    isActive,
    /** Execute an operation with automatic tracking */
    withTracking,
    /** The set of all currently active items (for advanced use cases) */
    activeItems,
    /** Manually start tracking for an item */
    startAction,
    /** Manually end tracking for an item */
    endAction,
  };
}
