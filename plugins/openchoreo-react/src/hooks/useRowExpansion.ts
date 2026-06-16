import { useCallback, useState } from 'react';

export interface UseRowExpansionResult {
  /**
   * Set of currently-expanded row keys. Call `expanded.has(key)` at render
   * time. The Set identity only changes when expansion actually changes, so
   * it's safe to put in `useEffect`/`useMemo` deps.
   */
  expanded: ReadonlySet<string>;
  /** Flip the expanded/collapsed state for the given row key. */
  toggle: (key: string) => void;
  /**
   * Collapse all rows. Useful when the underlying data is wholesale replaced
   * (e.g. a filter change) and you don't want stale keys to silently expand
   * newly loaded rows that happen to share a key.
   */
  reset: () => void;
}

/**
 * Track which rows in a virtualized list are expanded, keyed by a stable row
 * id. Lifting expansion to the parent like this is necessary because a
 * virtualizer unmounts rows that scroll off-screen — row-local `useState`
 * would forget the expansion as soon as the row leaves the overscan window.
 *
 * Use the same key as the list's `getItemKey` so expansion state survives
 * scroll-out-and-back.
 *
 * Exposes the underlying Set rather than an `isExpanded(key)` callback so the
 * identity only changes when a row is toggled — putting an `isExpanded`
 * callback in a `useEffect` dep array would cause the effect to re-run on
 * every toggle.
 */
export function useRowExpansion(): UseRowExpansionResult {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const toggle = useCallback((key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => setExpanded(new Set()), []);

  return { expanded, toggle, reset };
}
