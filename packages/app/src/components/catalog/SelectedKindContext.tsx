import {
  createContext,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

/**
 * The catalog Kind selection, shared between the `ChoreoEntityKindPicker` and
 * `CatalogCardList`.
 *
 * Why this exists: `useEntityList()` only exposes the *applied* kind
 * (`filters.kind`), which the provider updates **after** the new kind's fetch
 * resolves — and the URL is likewise rewritten (via `history.replaceState`)
 * only post-fetch. So during an in-app kind switch, neither `filters.kind` nor
 * `queryParameters.kind` reflects the newly picked kind synchronously. The
 * picker's own `onChange` is the only place that knows the new kind on the same
 * tick as the click. Publishing it here lets `CatalogCardList` detect a kind
 * switch immediately (so an uncached switch shows the full-page loader instead
 * of lingering on the previous kind's rows), rather than waiting a round-trip.
 */
export interface SelectedKindContextValue {
  /** Lowercased selected kind, or `undefined` before any in-app selection. */
  selectedKind: string | undefined;
  /** Publish the kind the user just picked (called synchronously from onChange). */
  setSelectedKind: (kind: string) => void;
}

const SelectedKindContext = createContext<SelectedKindContextValue | undefined>(
  undefined,
);

/**
 * Holds the synchronously-selected catalog kind. Mount inside the
 * `EntityListProvider` so it wraps the picker(s) and the list.
 */
export const SelectedKindProvider = ({ children }: PropsWithChildren<{}>) => {
  const [selectedKind, setSelectedKindState] = useState<string | undefined>(
    undefined,
  );

  const value = useMemo<SelectedKindContextValue>(
    () => ({
      selectedKind,
      setSelectedKind: (kind: string) =>
        setSelectedKindState(kind.toLowerCase()),
    }),
    [selectedKind],
  );

  return (
    <SelectedKindContext.Provider value={value}>
      {children}
    </SelectedKindContext.Provider>
  );
};

/**
 * Read the shared selected kind. Returns `undefined` for `selectedKind` (and a
 * no-op setter) when used outside a `SelectedKindProvider`, so consumers degrade
 * to their own kind derivation instead of throwing.
 */
export function useSelectedKind(): SelectedKindContextValue {
  return (
    useContext(SelectedKindContext) ?? {
      selectedKind: undefined,
      setSelectedKind: () => {},
    }
  );
}
