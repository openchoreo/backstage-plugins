import { useState, useCallback } from 'react';
import type { FileVar, Container } from '@openchoreo/backstage-plugin-common';

/** Tracks which file var row is currently being edited */
export interface EditingRowState {
  containerName: string;
  index: number;
  isNew?: boolean;
}

export interface UseFileVarEditBufferOptions {
  /** Container data to reference when starting edits */
  containers: { [key: string]: Container };
  /** Callback to replace an entire file var at once (preferred to avoid race conditions) */
  onFileVarReplace?: (
    containerName: string,
    fileIndex: number,
    fileVar: FileVar,
  ) => void;
  /** Fallback callback for individual field changes */
  onFileVarChange: (
    containerName: string,
    fileIndex: number,
    field: keyof FileVar,
    value: any,
  ) => void;
  /** Callback to remove a file var */
  onRemoveFileVar: (containerName: string, fileIndex: number) => void;
}

export interface UseFileVarEditBufferResult {
  /** Currently editing row info, or null if not editing */
  editingRow: EditingRowState | null;
  /** Buffer holding uncommitted changes */
  editBuffer: FileVar | null;
  /** Whether any row is currently being edited */
  isAnyRowEditing: boolean;
  /** Check if a specific row is being edited */
  isRowEditing: (containerName: string, index: number) => boolean;
  /** Start editing an existing file var row */
  startEdit: (containerName: string, index: number) => void;
  /** Start editing a new file var row (or one being overridden) */
  startNew: (
    containerName: string,
    index: number,
    initialFileVar?: FileVar,
  ) => void;
  /** Apply buffered changes to parent state */
  applyEdit: () => void;
  /** Cancel editing and discard buffer (removes new rows) */
  cancelEdit: () => void;
  /** Update a field in the edit buffer (does not commit to parent) */
  updateBuffer: (field: keyof FileVar, value: any) => void;
  /** Set the entire buffer (useful for mode changes) */
  setBuffer: (fileVar: FileVar) => void;
  /** Clear edit state without side effects (used when row is deleted externally) */
  clearEditState: () => void;
}

/**
 * Check if a file var is empty (no key, no mount path, no value, no secret ref)
 */
function isFileVarEmpty(fileVar: FileVar | undefined | null): boolean {
  if (!fileVar) return true;
  return (
    !fileVar.key &&
    !fileVar.mountPath &&
    !fileVar.value &&
    !fileVar.valueFrom?.secretRef?.name
  );
}

/**
 * Hook for managing single-row file var editing with a local buffer.
 *
 * This hook implements a pattern where:
 * - Only one row can be edited at a time
 * - Changes are buffered locally until Apply is clicked
 * - Cancel discards the buffer (and removes new rows)
 * - Apply commits the buffer to parent state
 *
 * @example
 * ```tsx
 * const editBuffer = useFileVarEditBuffer({
 *   containers,
 *   onFileVarReplace,
 *   onFileVarChange,
 *   onRemoveFileVar,
 * });
 *
 * // In render
 * <FileVarEditor
 *   isEditing={editBuffer.isRowEditing(containerName, index)}
 *   fileVar={editBuffer.isRowEditing(containerName, index) ? editBuffer.editBuffer : fileVar}
 *   onEdit={() => editBuffer.startEdit(containerName, index)}
 *   onApply={editBuffer.applyEdit}
 *   onCancel={editBuffer.cancelEdit}
 *   onChange={editBuffer.updateBuffer}
 * />
 * ```
 */
export function useFileVarEditBuffer(
  options: UseFileVarEditBufferOptions,
): UseFileVarEditBufferResult {
  const { containers, onFileVarReplace, onFileVarChange, onRemoveFileVar } =
    options;

  // Track which row is currently being edited (only one at a time)
  const [editingRow, setEditingRow] = useState<EditingRowState | null>(null);

  // Buffer for edits - changes are stored here until Apply is clicked
  const [editBuffer, setEditBuffer] = useState<FileVar | null>(null);

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
      const fileVar = (containers[containerName] as any)?.files?.[index];
      // Deep copy to buffer for editing
      setEditBuffer(
        fileVar
          ? JSON.parse(JSON.stringify(fileVar))
          : { key: '', mountPath: '', value: '' },
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
    (containerName: string, index: number, initialFileVar?: FileVar) => {
      setEditBuffer(
        initialFileVar
          ? JSON.parse(JSON.stringify(initialFileVar))
          : { key: '', mountPath: '', value: '' },
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
    if (isFileVarEmpty(editBuffer)) {
      onRemoveFileVar(containerName, index);
      setEditBuffer(null);
      setEditingRow(null);
      return;
    }

    // Commit entire file var at once to avoid race conditions
    if (onFileVarReplace) {
      onFileVarReplace(containerName, index, editBuffer);
    } else {
      // Fallback to individual field updates (may have race condition issues)
      onFileVarChange(containerName, index, 'key', editBuffer.key || '');
      onFileVarChange(
        containerName,
        index,
        'mountPath',
        editBuffer.mountPath || '',
      );
      onFileVarChange(containerName, index, 'value', editBuffer.value as any);
      onFileVarChange(
        containerName,
        index,
        'valueFrom',
        editBuffer.valueFrom as any,
      );
    }

    setEditBuffer(null);
    setEditingRow(null);
  }, [
    editingRow,
    editBuffer,
    onFileVarReplace,
    onFileVarChange,
    onRemoveFileVar,
  ]);

  // Cancel editing - discards buffer, removes new rows
  const cancelEdit = useCallback(() => {
    if (!editingRow) return;

    if (editingRow.isNew) {
      // NEW row: Cancel = Delete the row entirely
      onRemoveFileVar(editingRow.containerName, editingRow.index);
    }
    // For existing rows: just discard buffer, original values are still in containers prop

    setEditBuffer(null);
    setEditingRow(null);
  }, [editingRow, onRemoveFileVar]);

  // Clear edit state without any side effects (used when row is deleted externally)
  const clearEditState = useCallback(() => {
    setEditBuffer(null);
    setEditingRow(null);
  }, []);

  // Update a single field in the buffer
  const updateBuffer = useCallback((field: keyof FileVar, value: any) => {
    setEditBuffer(prev => (prev ? { ...prev, [field]: value } : null));
  }, []);

  // Set the entire buffer (useful for mode changes that need to reset multiple fields)
  const setBuffer = useCallback((fileVar: FileVar) => {
    setEditBuffer(fileVar);
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
    clearEditState,
  };
}
