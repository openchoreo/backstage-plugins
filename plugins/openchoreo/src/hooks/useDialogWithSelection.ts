import { useState, useCallback } from 'react';

/**
 * Hook for managing dialog state with an associated selected item.
 * Ensures dialog open state and selection are always in sync.
 *
 * @example
 * const overridesDialog = useDialogWithSelection<Environment>();
 *
 * // Open dialog with selection
 * overridesDialog.open(environment);
 *
 * // Close dialog (automatically clears selection)
 * overridesDialog.close();
 *
 * // In JSX
 * <Dialog open={overridesDialog.isOpen} onClose={overridesDialog.close}>
 *   {overridesDialog.selected && <Content item={overridesDialog.selected} />}
 * </Dialog>
 */
export function useDialogWithSelection<T>() {
  const [state, setState] = useState<{
    isOpen: boolean;
    selected: T | null;
  }>({
    isOpen: false,
    selected: null,
  });

  const open = useCallback((item: T) => {
    setState({ isOpen: true, selected: item });
  }, []);

  const close = useCallback(() => {
    setState({ isOpen: false, selected: null });
  }, []);

  return {
    isOpen: state.isOpen,
    selected: state.selected,
    open,
    close,
  };
}
