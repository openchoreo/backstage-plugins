import { useState, useMemo, useCallback } from 'react';
import { ComponentTrait } from '../../../api/traits';
import { TraitWithState, PendingChanges } from '../types';

export const usePendingChanges = (initialTraits: ComponentTrait[]) => {
  const [traitsState, setTraitsState] = useState<TraitWithState[]>(() =>
    initialTraits.map(trait => ({ ...trait, state: 'original' as const })),
  );

  // Sync with server state when initial traits change
  useMemo(() => {
    setTraitsState(
      initialTraits.map(trait => ({ ...trait, state: 'original' as const })),
    );
  }, [initialTraits]);

  const addTrait = useCallback((trait: ComponentTrait) => {
    setTraitsState(prev => [...prev, { ...trait, state: 'added' as const }]);
  }, []);

  const editTrait = useCallback(
    (instanceName: string, updated: ComponentTrait) => {
      setTraitsState(prev =>
        prev.map(trait => {
          if (trait.instanceName === instanceName) {
            if (trait.state === 'added') {
              // Still in added state
              return { ...updated, state: 'added' as const };
            }
            // Mark as modified and keep original data
            return {
              ...updated,
              state: 'modified' as const,
              originalData: trait.originalData || {
                name: trait.name,
                instanceName: trait.instanceName,
                parameters: trait.parameters,
              },
            };
          }
          return trait;
        }),
      );
    },
    [],
  );

  const deleteTrait = useCallback((instanceName: string) => {
    setTraitsState(prev =>
      prev
        .map(trait => {
          if (trait.instanceName === instanceName) {
            if (trait.state === 'added') {
              // Remove from list if it was just added
              return null;
            }
            // Mark as deleted
            return { ...trait, state: 'deleted' as const };
          }
          return trait;
        })
        .filter((t): t is TraitWithState => t !== null),
    );
  }, []);

  const undoDelete = useCallback((instanceName: string) => {
    setTraitsState(prev =>
      prev.map(trait => {
        if (trait.instanceName === instanceName && trait.state === 'deleted') {
          // Restore to original or modified state
          return {
            ...trait,
            state: trait.originalData
              ? ('modified' as const)
              : ('original' as const),
          };
        }
        return trait;
      }),
    );
  }, []);

  const discardAll = useCallback(() => {
    setTraitsState(
      initialTraits.map(trait => ({ ...trait, state: 'original' as const })),
    );
  }, [initialTraits]);

  const hasChanges = useMemo(() => {
    return traitsState.some(trait => trait.state !== 'original');
  }, [traitsState]);

  const pendingChanges: PendingChanges = useMemo(() => {
    const added = traitsState.filter(t => t.state === 'added');
    const modified = traitsState
      .filter(t => t.state === 'modified')
      .map(t => ({
        original: t.originalData!,
        updated: {
          name: t.name,
          instanceName: t.instanceName,
          parameters: t.parameters,
        },
      }));
    const deleted = traitsState.filter(t => t.state === 'deleted');

    return { added, modified, deleted };
  }, [traitsState]);

  const getTraitsForSave = useCallback((): ComponentTrait[] => {
    return traitsState
      .filter(trait => trait.state !== 'deleted')
      .map(({ state, originalData, ...trait }) => trait);
  }, [traitsState]);

  return {
    traitsState,
    pendingChanges,
    hasChanges,
    addTrait,
    editTrait,
    deleteTrait,
    undoDelete,
    discardAll,
    getTraitsForSave,
  };
};
