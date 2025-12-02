import { useState, useCallback } from 'react';
import type { EnvVar, Container } from '@openchoreo/backstage-plugin-common';

/** Tracks which env var row is currently being edited */
export interface EditingRowState {
  containerName: string;
  index: number;
  isNew?: boolean;
}

export interface UseEnvVarEditBufferOptions {
  /** Container data to reference when starting edits */
  containers: { [key: string]: Container };
  /** Callback to replace an entire env var at once (preferred to avoid race conditions) */
  onEnvVarReplace?: (
    containerName: string,
    envIndex: number,
    envVar: EnvVar,
  ) => void;
  /** Fallback callback for individual field changes */
  onEnvVarChange: (
    containerName: string,
    envIndex: number,
    field: keyof EnvVar,
    value: any,
  ) => void;
  /** Callback to remove an env var */
  onRemoveEnvVar: (containerName: string, envIndex: number) => void;
}

export interface UseEnvVarEditBufferResult {
  /** Currently editing row info, or null if not editing */
  editingRow: EditingRowState | null;
  /** Buffer holding uncommitted changes */
  editBuffer: EnvVar | null;
  /** Whether any row is currently being edited */
  isAnyRowEditing: boolean;
  /** Check if a specific row is being edited */
  isRowEditing: (containerName: string, index: number) => boolean;
  /** Start editing an existing env var row */
  startEdit: (containerName: string, index: number) => void;
  /** Start editing a new env var row (or one being overridden) */
  startNew: (
    containerName: string,
    index: number,
    initialEnvVar?: EnvVar,
  ) => void;
  /** Apply buffered changes to parent state */
  applyEdit: () => void;
  /** Cancel editing and discard buffer (removes new rows) */
  cancelEdit: () => void;
  /** Update a field in the edit buffer (does not commit to parent) */
  updateBuffer: (field: keyof EnvVar, value: any) => void;
  /** Set the entire buffer (useful for mode changes) */
  setBuffer: (envVar: EnvVar) => void;
}

/**
 * Check if an env var is empty (no key, no value, no secret ref)
 */
function isEnvVarEmpty(envVar: EnvVar | undefined | null): boolean {
  if (!envVar) return true;
  return !envVar.key && !envVar.value && !envVar.valueFrom?.secretRef?.name;
}

/**
 * Hook for managing single-row editing with a local buffer.
 *
 * This hook implements a pattern where:
 * - Only one row can be edited at a time
 * - Changes are buffered locally until Apply is clicked
 * - Cancel discards the buffer (and removes new rows)
 * - Apply commits the buffer to parent state
 *
 * @example
 * ```tsx
 * const editBuffer = useEnvVarEditBuffer({
 *   containers,
 *   onEnvVarReplace,
 *   onEnvVarChange,
 *   onRemoveEnvVar,
 * });
 *
 * // In render
 * <EnvVarEditor
 *   isEditing={editBuffer.isRowEditing(containerName, index)}
 *   envVar={editBuffer.isRowEditing(containerName, index) ? editBuffer.editBuffer : envVar}
 *   onEdit={() => editBuffer.startEdit(containerName, index)}
 *   onApply={editBuffer.applyEdit}
 *   onCancel={editBuffer.cancelEdit}
 *   onChange={editBuffer.updateBuffer}
 * />
 * ```
 */
export function useEnvVarEditBuffer(
  options: UseEnvVarEditBufferOptions,
): UseEnvVarEditBufferResult {
  const { containers, onEnvVarReplace, onEnvVarChange, onRemoveEnvVar } =
    options;

  // Track which row is currently being edited (only one at a time)
  const [editingRow, setEditingRow] = useState<EditingRowState | null>(null);

  // Buffer for edits - changes are stored here until Apply is clicked
  const [editBuffer, setEditBuffer] = useState<EnvVar | null>(null);

  const isAnyRowEditing = editingRow !== null;

  const isRowEditing = useCallback(
    (containerName: string, index: number): boolean => {
      return (
        editingRow?.containerName === containerName &&
        editingRow?.index === index
      );
    },
    [editingRow],
  );

  // Start editing an existing row - initialize buffer with current values
  const startEdit = useCallback(
    (containerName: string, index: number) => {
      const envVar = containers[containerName]?.env?.[index];
      // Deep copy to buffer for editing
      setEditBuffer(
        envVar ? JSON.parse(JSON.stringify(envVar)) : { key: '', value: '' },
      );
      setEditingRow({
        containerName,
        index,
        isNew: false,
      });
    },
    [containers],
  );

  // Start editing a new row (or override) - optionally pre-fill with initial values
  const startNew = useCallback(
    (containerName: string, index: number, initialEnvVar?: EnvVar) => {
      setEditBuffer(
        initialEnvVar
          ? JSON.parse(JSON.stringify(initialEnvVar))
          : { key: '', value: '' },
      );
      setEditingRow({
        containerName,
        index,
        isNew: true,
      });
    },
    [],
  );

  // Apply buffered changes - commits buffer to parent state
  const applyEdit = useCallback(() => {
    if (!editingRow || !editBuffer) return;

    const { containerName, index } = editingRow;

    // If buffer is empty, remove the row
    if (isEnvVarEmpty(editBuffer)) {
      onRemoveEnvVar(containerName, index);
      setEditBuffer(null);
      setEditingRow(null);
      return;
    }

    // Commit entire env var at once to avoid race conditions
    if (onEnvVarReplace) {
      onEnvVarReplace(containerName, index, editBuffer);
    } else {
      // Fallback to individual field updates (may have race condition issues)
      onEnvVarChange(containerName, index, 'key', editBuffer.key || '');
      onEnvVarChange(containerName, index, 'value', editBuffer.value as any);
      onEnvVarChange(
        containerName,
        index,
        'valueFrom',
        editBuffer.valueFrom as any,
      );
    }

    setEditBuffer(null);
    setEditingRow(null);
  }, [editingRow, editBuffer, onEnvVarReplace, onEnvVarChange, onRemoveEnvVar]);

  // Cancel editing - discards buffer, removes new rows
  const cancelEdit = useCallback(() => {
    if (!editingRow) return;

    if (editingRow.isNew) {
      // NEW row: Cancel = Delete the row entirely
      onRemoveEnvVar(editingRow.containerName, editingRow.index);
    }
    // For existing rows: just discard buffer, original values are still in containers prop

    setEditBuffer(null);
    setEditingRow(null);
  }, [editingRow, onRemoveEnvVar]);

  // Update a single field in the buffer
  const updateBuffer = useCallback((field: keyof EnvVar, value: any) => {
    setEditBuffer(prev => (prev ? { ...prev, [field]: value } : null));
  }, []);

  // Set the entire buffer (useful for mode changes that need to reset multiple fields)
  const setBuffer = useCallback((envVar: EnvVar) => {
    setEditBuffer(envVar);
  }, []);

  return {
    editingRow,
    editBuffer,
    isAnyRowEditing,
    isRowEditing,
    startEdit,
    startNew,
    applyEdit,
    cancelEdit,
    updateBuffer,
    setBuffer,
  };
}
