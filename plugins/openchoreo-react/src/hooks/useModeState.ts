import { useState, useCallback } from 'react';
import type { Container } from '@openchoreo/backstage-plugin-common';

export type ValueMode = 'plain' | 'secret';

export interface UseModeStateResult {
  /** Get the current mode for a specific item */
  getMode: (containerName: string, index: number) => ValueMode;
  /** Set the mode for a specific item */
  setMode: (containerName: string, index: number, mode: ValueMode) => void;
  /** Clean up mode state when an item is removed (shifts subsequent indices) */
  cleanupIndex: (containerName: string, removedIndex: number) => void;
  /** Clean up all mode state for a container */
  cleanupContainer: (containerName: string) => void;
}

export interface UseModeStateOptions {
  /** Type of value being tracked ('env' for environment variables, 'file' for file mounts) */
  type: 'env' | 'file';
  /** Initial containers to derive mode from existing data */
  initialContainers?: Record<string, Container>;
}

/**
 * Hook for managing plain/secret mode state for environment variables or file mounts.
 *
 * This hook tracks which items are in 'plain' or 'secret' mode using a key-based state map.
 * It handles:
 * - Getting mode from existing data (if it has valueFrom.secretRef, it's secret mode)
 * - Setting mode for UI state
 * - Cleaning up state when items are removed
 * - Shifting indices when items are removed from the middle
 *
 * @example
 * ```tsx
 * const envModes = useModeState({ type: 'env', initialContainers: containers });
 * const fileModes = useModeState({ type: 'file', initialContainers: containers });
 *
 * // In render
 * const mode = envModes.getMode('main', 0);
 * // When switching mode
 * envModes.setMode('main', 0, 'secret');
 * // When removing an item
 * envModes.cleanupIndex('main', 0);
 * ```
 */
export function useModeState(options: UseModeStateOptions): UseModeStateResult {
  const { type, initialContainers } = options;
  const [modeState, setModeState] = useState<Record<string, ValueMode>>({});

  const getMode = useCallback(
    (containerName: string, index: number): ValueMode => {
      const key = `${containerName}-${index}`;

      // Check local state first
      if (modeState[key]) {
        return modeState[key];
      }

      // Derive mode from initial data if available
      if (initialContainers) {
        const container = initialContainers[containerName];
        if (container) {
          if (type === 'env') {
            const envVar = container.env?.[index];
            if (envVar?.valueFrom?.secretRef) {
              return 'secret';
            }
          } else if (type === 'file') {
            const fileVar = (container as any).files?.[index];
            if (fileVar?.valueFrom?.secretRef) {
              return 'secret';
            }
          }
        }
      }

      return 'plain';
    },
    [modeState, initialContainers, type],
  );

  const setMode = useCallback(
    (containerName: string, index: number, mode: ValueMode) => {
      const key = `${containerName}-${index}`;
      setModeState(prev => ({ ...prev, [key]: mode }));
    },
    [],
  );

  const cleanupIndex = useCallback(
    (containerName: string, removedIndex: number) => {
      setModeState(prev => {
        const newState = { ...prev };

        // Remove the mode for the deleted item
        delete newState[`${containerName}-${removedIndex}`];

        // Get count of items for this container (approximate by finding max index)
        let maxIndex = 0;
        Object.keys(newState).forEach(key => {
          if (key.startsWith(`${containerName}-`)) {
            const idx = parseInt(key.split('-').pop() || '0', 10);
            if (idx > maxIndex) maxIndex = idx;
          }
        });

        // Shift modes for items that came after the removed one
        for (let i = removedIndex + 1; i <= maxIndex + 1; i++) {
          const oldKey = `${containerName}-${i}`;
          const newKey = `${containerName}-${i - 1}`;

          if (newState[oldKey]) {
            newState[newKey] = newState[oldKey];
            delete newState[oldKey];
          }
        }

        return newState;
      });
    },
    [],
  );

  const cleanupContainer = useCallback((containerName: string) => {
    setModeState(prev => {
      const newState = { ...prev };
      Object.keys(newState).forEach(key => {
        if (key.startsWith(`${containerName}-`)) {
          delete newState[key];
        }
      });
      return newState;
    });
  }, []);

  return {
    getMode,
    setMode,
    cleanupIndex,
    cleanupContainer,
  };
}
