import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Options for the useUrlSyncedTab hook
 */
export interface UseUrlSyncedTabOptions<T extends string = string> {
  /** Initial tab value from URL (passed from parent/wrapper) */
  initialTab: T | undefined;
  /** Default tab to use when initialTab is undefined */
  defaultTab: T;
  /** Callback to update URL when tab changes. Pass replace=true to avoid adding to history. */
  onTabChange?: (tab: T, replace?: boolean) => void;
}

/**
 * Result tuple from useUrlSyncedTab hook
 */
export type UseUrlSyncedTabResult<T extends string = string> = [
  /** Current active tab */
  T,
  /** Function to change the active tab (updates both local state and URL). Pass replace=true to avoid adding to history. */
  (tab: T, replace?: boolean) => void,
];

/**
 * Hook for managing tab state that syncs with URL.
 *
 * This hook handles the common pattern of:
 * 1. Initializing tab state from URL (via initialTab prop)
 * 2. Syncing tab state when URL changes (browser back/forward)
 * 3. Updating URL when user changes tabs
 *
 * @example
 * ```tsx
 * const [activeTab, setActiveTab] = useUrlSyncedTab({
 *   initialTab,      // from URL via wrapper
 *   defaultTab: 'overview',
 *   onTabChange,     // callback to update URL
 * });
 *
 * return (
 *   <VerticalTabNav
 *     tabs={tabs}
 *     activeTabId={activeTab}
 *     onChange={setActiveTab}
 *   />
 * );
 * ```
 */
export function useUrlSyncedTab<T extends string = string>({
  initialTab,
  defaultTab,
  onTabChange,
}: UseUrlSyncedTabOptions<T>): UseUrlSyncedTabResult<T> {
  const [activeTab, setActiveTabState] = useState<T>(initialTab ?? defaultTab);

  // Track initial mount to avoid unnecessary state updates
  const isInitialMount = useRef(true);

  // Sync with URL when initialTab changes (browser back/forward)
  useEffect(() => {
    // Skip the initial mount since useState already handles it
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Only update if initialTab is defined and different from current
    if (initialTab !== undefined && initialTab !== activeTab) {
      setActiveTabState(initialTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Deliberately exclude activeTab to avoid infinite loops
  }, [initialTab]);

  // Wrapper to update both local state and URL
  const setActiveTab = useCallback(
    (tab: T, replace?: boolean) => {
      setActiveTabState(tab);
      onTabChange?.(tab, replace);
    },
    [onTabChange],
  );

  return [activeTab, setActiveTab];
}
