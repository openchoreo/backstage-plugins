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

  // The tab last requested, which may not have reached activeTab yet.
  const requestedTab = useRef<T>(initialTab ?? defaultTab);

  // Sync with URL when initialTab changes (browser back/forward)
  useEffect(() => {
    // Skip the initial mount since useState already handles it
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Only update if initialTab is defined and different from current
    if (initialTab !== undefined && initialTab !== activeTab) {
      requestedTab.current = initialTab;
      setActiveTabState(initialTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Deliberately exclude activeTab to avoid infinite loops
  }, [initialTab]);

  // Since Backstage 1.57 a navigation re-renders synchronously, before the
  // tab state update lands. An effect that picks a default tab therefore runs
  // again with the old activeTab and asks for the same tab, and navigating
  // again would loop until React gives up (error #185). So a repeated request
  // for the tab already requested does not touch the URL. onTabChange is read
  // through a ref because callers derive it from the current location. The ref
  // is updated in an effect so a render React discards cannot leave its
  // callback behind; this effect runs before the caller's own effects.
  const onTabChangeRef = useRef(onTabChange);
  useEffect(() => {
    onTabChangeRef.current = onTabChange;
  });

  // Wrapper to update both local state and URL
  const setActiveTab = useCallback((tab: T, replace?: boolean) => {
    setActiveTabState(tab);
    if (tab === requestedTab.current) return;
    requestedTab.current = tab;
    onTabChangeRef.current?.(tab, replace);
  }, []);

  return [activeTab, setActiveTab];
}
