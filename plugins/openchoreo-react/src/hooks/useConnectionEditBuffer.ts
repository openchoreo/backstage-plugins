import { useState, useCallback } from 'react';
import type { Connection } from '@openchoreo/backstage-plugin-common';

/** Tracks which dependency row is currently being edited */
export interface DependencyEditingRowState {
  index: number;
  isNew?: boolean;
}

/** @deprecated Use DependencyEditingRowState instead */
export type ConnectionEditingRowState = DependencyEditingRowState;

export interface UseDependencyEditBufferOptions {
  /** Dependency data to reference when starting edits */
  dependencies: Connection[];
  /** Callback to replace an entire dependency at an index */
  onDependencyReplace?: (index: number, dependency: Connection) => void;
  /** Callback to remove a dependency by index */
  onRemoveDependency: (index: number) => void;
  /** Default project to populate when a dependency has no project set (API omits it for same-project) */
  defaultProject?: string;
}

/** @deprecated Use UseDependencyEditBufferOptions instead */
export type UseConnectionEditBufferOptions = UseDependencyEditBufferOptions;

export interface UseDependencyEditBufferResult {
  /** Currently editing row info, or null if not editing */
  editingRow: DependencyEditingRowState | null;
  /** Buffer holding uncommitted changes */
  editBuffer: Connection | null;
  /** Whether any row is currently being edited */
  isAnyRowEditing: boolean;
  /** Whether the current buffer is valid (all required fields filled) */
  isBufferValid: boolean;
  /** Check if a specific row is being edited */
  isRowEditing: (index: number) => boolean;
  /** Start editing an existing dependency row */
  startEdit: (index: number) => void;
  /** Start editing a new dependency row */
  startNew: (index: number, initialDependency?: Connection) => void;
  /** Apply buffered changes to parent state */
  applyEdit: () => void;
  /** Cancel editing and discard buffer (removes new rows) */
  cancelEdit: () => void;
  /** Update a field in the edit buffer (does not commit to parent) */
  updateBuffer: (field: keyof Connection, value: any) => void;
  /** Update a nested field in envBindings */
  updateBufferEnvBindings: (field: string, value: string) => void;
  /** Set the entire buffer (useful for complex updates) */
  setBuffer: (dependency: Connection) => void;
  /** Clear edit state without side effects (used when row is deleted externally) */
  clearEditState: () => void;
}

/** @deprecated Use UseDependencyEditBufferResult instead */
export type UseConnectionEditBufferResult = UseDependencyEditBufferResult;

/**
 * Check if a dependency is truly empty (no data entered at all)
 */
function isDependencyEmpty(dependency: Connection | undefined | null): boolean {
  if (!dependency) return true;
  return !dependency.component && !dependency.name;
}

/**
 * Check if a dependency is valid (all required fields filled)
 */
function isDependencyValid(dependency: Connection | undefined | null): boolean {
  if (!dependency) return false;
  return !!(
    dependency.component &&
    dependency.name &&
    dependency.visibility
  );
}

/**
 * Hook for managing single-row editing of dependencies with a local buffer.
 *
 * This hook implements a pattern where:
 * - Only one row can be edited at a time
 * - Changes are buffered locally until Apply is clicked
 * - Cancel discards the buffer (and removes new rows)
 * - Apply commits the buffer to parent state
 */
export function useDependencyEditBuffer(
  options: UseDependencyEditBufferOptions,
): UseDependencyEditBufferResult {
  const {
    dependencies,
    onDependencyReplace,
    onRemoveDependency,
    defaultProject,
  } = options;

  // Track which row is currently being edited (only one at a time)
  const [editingRow, setEditingRow] =
    useState<DependencyEditingRowState | null>(null);

  // Buffer for edits - changes are stored here until Apply is clicked
  const [editBuffer, setEditBuffer] = useState<Connection | null>(null);

  const isAnyRowEditing = editingRow !== null;
  const isBufferValid = isDependencyValid(editBuffer);

  const isRowEditing = useCallback(
    (index: number): boolean => {
      return editingRow?.index === index;
    },
    [editingRow],
  );

  // Start editing an existing row - initialize buffer with current values
  const startEdit = useCallback(
    (index: number) => {
      const dependency = dependencies[index];
      // Deep copy to buffer for editing
      const buffer: Connection = dependency
        ? JSON.parse(JSON.stringify(dependency))
        : {
            component: '',
            name: '',
            visibility: 'project' as const,
            envBindings: {},
          };
      // When project is omitted (API convention for same-project), fill it in for the UI
      if (!buffer.project && defaultProject) {
        buffer.project = defaultProject;
      }
      setEditBuffer(buffer);
      setEditingRow({ index, isNew: false });
    },
    [dependencies, defaultProject],
  );

  // Start editing a new row - optionally pre-fill with initial values
  const startNew = useCallback(
    (index: number, initialDependency?: Connection) => {
      const buffer: Connection = initialDependency
        ? JSON.parse(JSON.stringify(initialDependency))
        : {
            component: '',
            name: '',
            visibility: 'project' as const,
            envBindings: {},
          };
      if (!buffer.project && defaultProject) {
        buffer.project = defaultProject;
      }
      setEditBuffer(buffer);
      setEditingRow({ index, isNew: true });
    },
    [defaultProject],
  );

  // Apply buffered changes - commits buffer to parent state
  const applyEdit = useCallback(() => {
    if (!editingRow || !editBuffer) return;

    const { index } = editingRow;

    // If buffer is empty, remove the row
    if (isDependencyEmpty(editBuffer)) {
      onRemoveDependency(index);
      setEditBuffer(null);
      setEditingRow(null);
      return;
    }

    // Don't commit invalid buffers — keep the row editable so the user can fix it
    if (!isDependencyValid(editBuffer)) {
      return;
    }

    if (onDependencyReplace) {
      onDependencyReplace(index, editBuffer);
    }

    setEditBuffer(null);
    setEditingRow(null);
  }, [editingRow, editBuffer, onDependencyReplace, onRemoveDependency]);

  // Cancel editing - discards buffer, removes new rows
  const cancelEdit = useCallback(() => {
    if (!editingRow) return;

    if (editingRow.isNew) {
      // NEW row: Cancel = Delete the row entirely
      onRemoveDependency(editingRow.index);
    }
    // For existing rows: just discard buffer, original values are still in dependencies prop

    setEditBuffer(null);
    setEditingRow(null);
  }, [editingRow, onRemoveDependency]);

  // Clear edit state without any side effects (used when row is deleted externally)
  const clearEditState = useCallback(() => {
    setEditBuffer(null);
    setEditingRow(null);
  }, []);

  // Update a single field in the buffer
  const updateBuffer = useCallback((field: keyof Connection, value: any) => {
    setEditBuffer(prev => (prev ? { ...prev, [field]: value } : null));
  }, []);

  // Update a nested field in envBindings
  const updateBufferEnvBindings = useCallback(
    (field: string, value: string) => {
      setEditBuffer(prev =>
        prev
          ? {
              ...prev,
              envBindings: { ...prev.envBindings, [field]: value },
            }
          : null,
      );
    },
    [],
  );

  // Set the entire buffer
  const setBuffer = useCallback((dependency: Connection) => {
    setEditBuffer(dependency);
  }, []);

  return {
    editingRow,
    editBuffer,
    isAnyRowEditing,
    isBufferValid,
    isRowEditing,
    startEdit,
    startNew,
    applyEdit,
    cancelEdit,
    updateBuffer,
    updateBufferEnvBindings,
    setBuffer,
    clearEditState,
  };
}

/** @deprecated Use useDependencyEditBuffer instead */
export const useConnectionEditBuffer = useDependencyEditBuffer;
