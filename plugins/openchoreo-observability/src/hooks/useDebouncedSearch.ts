import { ChangeEvent, useState, useEffect } from 'react';
import { useDebounce } from 'react-use';

const DEFAULT_DEBOUNCE_MS = 1000;

/**
 * Manages a debounced search input that stays in sync with an external value.
 *
 * @param externalValue - The current search value from the parent's filter state.
 *   When this changes externally (e.g. URL reset), the local input is updated.
 * @param onChange - Called with the debounced search string after the user stops typing.
 * @param debounceMs - Debounce delay in milliseconds (default: 1000).
 * @returns A tuple of [searchInput, handleSearchChange] for binding to an input element.
 */
export function useDebouncedSearch(
  externalValue: string | undefined,
  onChange: (value: string) => void,
  debounceMs = DEFAULT_DEBOUNCE_MS,
): [string, (e: ChangeEvent<HTMLInputElement>) => void] {
  const [searchInput, setSearchInput] = useState(externalValue || '');

  // Sync local state when the external value is reset (e.g. filter reset from URL)
  useEffect(() => {
    setSearchInput(externalValue || '');
  }, [externalValue]);

  useDebounce(
    () => {
      onChange(searchInput);
    },
    debounceMs,
    [searchInput],
  );

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  };

  return [searchInput, handleSearchChange];
}
