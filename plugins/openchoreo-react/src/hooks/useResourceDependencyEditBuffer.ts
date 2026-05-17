import { useState, useCallback } from 'react';
import type { ResourceDependency } from '@openchoreo/backstage-plugin-common';

/** Tracks which resource dependency row is currently being edited. */
export interface ResourceDependencyEditingRowState {
  index: number;
  isNew?: boolean;
}

export interface UseResourceDependencyEditBufferOptions {
  /** Resource dependency data referenced when starting edits. */
  resources: ResourceDependency[];
  /** Replace the entire resource dependency at an index. */
  onResourceDependencyReplace?: (
    index: number,
    resource: ResourceDependency,
  ) => void;
  /** Remove the resource dependency at an index. */
  onRemoveResourceDependency: (index: number) => void;
}

export interface UseResourceDependencyEditBufferResult {
  editingRow: ResourceDependencyEditingRowState | null;
  editBuffer: ResourceDependency | null;
  isAnyRowEditing: boolean;
  isBufferValid: boolean;
  isRowEditing: (index: number) => boolean;
  startEdit: (index: number) => void;
  startNew: (index: number, initialDependency?: ResourceDependency) => void;
  applyEdit: () => void;
  cancelEdit: () => void;
  /** Replace the entire buffer (used by the editor to push field-level edits). */
  setBuffer: (dependency: ResourceDependency) => void;
  clearEditState: () => void;
}

function isResourceDependencyEmpty(dep: ResourceDependency | null): boolean {
  if (!dep) return true;
  // A resource dep with no ref AND no bindings has no meaningful content.
  const hasEnvBindings =
    !!dep.envBindings && Object.keys(dep.envBindings).length > 0;
  const hasFileBindings =
    !!dep.fileBindings && Object.keys(dep.fileBindings).length > 0;
  return !dep.ref && !hasEnvBindings && !hasFileBindings;
}

function isResourceDependencyValid(dep: ResourceDependency | null): boolean {
  if (!dep) return false;
  if (!dep.ref) return false;
  // Reject empty binding values; the openchoreo-api kubebuilder validation
  // rejects empty `envBindings`/`fileBindings` map values, so block Apply
  // until the user fills them in.
  const env = dep.envBindings ?? {};
  for (const v of Object.values(env)) {
    if (!v) return false;
  }
  const file = dep.fileBindings ?? {};
  for (const v of Object.values(file)) {
    if (!v) return false;
  }
  return true;
}

/**
 * Hook for single-row editing of resource dependencies with a local buffer.
 *
 * Mirrors `useDependencyEditBuffer` (endpoint side):
 * - Only one row can be edited at a time.
 * - Changes are buffered locally until Apply is clicked.
 * - Cancel discards the buffer and removes new rows.
 * - Apply commits the buffer to parent state via onResourceDependencyReplace.
 */
export function useResourceDependencyEditBuffer(
  options: UseResourceDependencyEditBufferOptions,
): UseResourceDependencyEditBufferResult {
  const {
    resources,
    onResourceDependencyReplace,
    onRemoveResourceDependency,
  } = options;

  const [editingRow, setEditingRow] =
    useState<ResourceDependencyEditingRowState | null>(null);
  const [editBuffer, setEditBuffer] = useState<ResourceDependency | null>(null);

  const isAnyRowEditing = editingRow !== null;
  const isBufferValid = isResourceDependencyValid(editBuffer);

  const isRowEditing = useCallback(
    (index: number): boolean => editingRow?.index === index,
    [editingRow],
  );

  const startEdit = useCallback(
    (index: number) => {
      const dep = resources[index];
      const buffer: ResourceDependency = dep
        ? (JSON.parse(JSON.stringify(dep)) as ResourceDependency)
        : { ref: '' };
      setEditBuffer(buffer);
      setEditingRow({ index, isNew: false });
    },
    [resources],
  );

  const startNew = useCallback(
    (index: number, initial?: ResourceDependency) => {
      const buffer: ResourceDependency = initial
        ? (JSON.parse(JSON.stringify(initial)) as ResourceDependency)
        : { ref: '' };
      setEditBuffer(buffer);
      setEditingRow({ index, isNew: true });
    },
    [],
  );

  const applyEdit = useCallback(() => {
    if (!editingRow || !editBuffer) return;
    const { index } = editingRow;

    if (isResourceDependencyEmpty(editBuffer)) {
      onRemoveResourceDependency(index);
      setEditBuffer(null);
      setEditingRow(null);
      return;
    }

    if (!isResourceDependencyValid(editBuffer)) {
      // Hold the row in edit mode so the user can fix invalid fields.
      return;
    }

    if (onResourceDependencyReplace) {
      onResourceDependencyReplace(index, editBuffer);
    }
    setEditBuffer(null);
    setEditingRow(null);
  }, [
    editingRow,
    editBuffer,
    onResourceDependencyReplace,
    onRemoveResourceDependency,
  ]);

  const cancelEdit = useCallback(() => {
    if (!editingRow) return;
    if (editingRow.isNew) {
      // New rows are removed entirely on cancel (mirrors endpoint behavior).
      onRemoveResourceDependency(editingRow.index);
    }
    setEditBuffer(null);
    setEditingRow(null);
  }, [editingRow, onRemoveResourceDependency]);

  const clearEditState = useCallback(() => {
    setEditBuffer(null);
    setEditingRow(null);
  }, []);

  const setBuffer = useCallback((dependency: ResourceDependency) => {
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
    setBuffer,
    clearEditState,
  };
}
