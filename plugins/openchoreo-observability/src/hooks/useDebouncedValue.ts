import { useEffect, useState } from 'react';
import { useDebounce } from 'react-use';

/**
 * Follows `value` after it has stopped changing for `delayMs`.
 *
 * A sibling of {@link useDebouncedSearch}, for the cases where the caller already holds
 * the value rather than a change event - MUI's `onInputChange` hands back a string, not
 * a `ChangeEvent`, so the search variant does not fit an Autocomplete.
 *
 * An empty value is adopted in the same render rather than a tick later. Clearing a
 * field is a deliberate act whose result should not arrive a beat behind it, and the
 * wider query it asks for is the one already on screen - but the sharper reason is that
 * a caller may clear this at the very moment it switches to asking about something
 * else, and one render still reporting the old text is long enough to ask the new
 * question with it.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useDebounce(() => setDebounced(value), delayMs, [value]);

  const cleared = value === '' || value === undefined || value === null;

  // Held in step as well as returned, so that typing straight after a clear debounces
  // from empty rather than from whatever stood before it.
  useEffect(() => {
    if (cleared) setDebounced(value);
  }, [cleared, value]);

  return cleared ? value : debounced;
}
