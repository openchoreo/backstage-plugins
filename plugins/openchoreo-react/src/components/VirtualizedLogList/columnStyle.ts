import { CSSProperties } from 'react';

/**
 * Build a `getColumnStyle(key)` helper for the body and header of a
 * virtualized div-based table.
 *
 * Pass a map of column key → flex basis (e.g. `'0 0 15%'`); any key NOT in the
 * map falls through to a `flex: 1 1 0%` default, so the one variable-width
 * column (the message/summary column that fills the remainder) doesn't need
 * to be declared.
 *
 * Replaces three near-identical `getColumnStyle` switches that lived next to
 * each observability table (logs/events/wirelogs).
 */
export function makeColumnStyle<K extends string | number>(
  flexByKey: Partial<Record<K, string>>,
): (key: K) => CSSProperties {
  // Cache the resolved style object per key so calls return a stable reference
  // — important because `style={getColumnStyle(field)}` runs once per cell per
  // render. Without this every call allocates a fresh object, defeating React's
  // style-prop reference equality and forcing every cell to be treated as
  // changed each render.
  const cache = new Map<K, CSSProperties>();
  const fillRemainder: CSSProperties = { flex: '1 1 0%', minWidth: 0 };
  return (key: K) => {
    const cached = cache.get(key);
    if (cached) return cached;
    const flex = flexByKey[key];
    const style: CSSProperties =
      flex !== undefined ? { flex, minWidth: 0 } : fillRemainder;
    cache.set(key, style);
    return style;
  };
}
