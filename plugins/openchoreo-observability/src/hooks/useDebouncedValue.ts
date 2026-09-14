import { useEffect, useState } from 'react';
import { useDebounce } from 'react-use';

/**
 * Follows `value` after it has stopped changing for `delayMs`.
 *
 * A sibling of {@link useDebouncedSearch}, for the cases where the caller already holds
 * the value rather than a change event - MUI's `onInputChange` hands back a string, not
 * a `ChangeEvent`, so the search variant does not fit an Autocomplete.
 *
 * An empty value is adopted immediately. Clearing a field is a deliberate act whose
 * result should not arrive a beat later, and the wider query it produces is the one
 * already on screen.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useDebounce(() => setDebounced(value), delayMs, [value]);

  useEffect(() => {
    if (value === '' || value === undefined || value === null) {
      setDebounced(value);
    }
  }, [value]);

  return debounced;
}
