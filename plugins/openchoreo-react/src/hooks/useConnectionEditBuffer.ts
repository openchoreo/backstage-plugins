import { useState, useCallback } from 'react';
import type { Connection } from '@openchoreo/backstage-plugin-common';

/** Tracks which connection row is currently being edited */
export interface ConnectionEditingRowState {
  index: number;
  isNew?: boolean;
}

export interface UseConnectionEditBufferOptions {
  /** Connection data to reference when starting edits */
  connections: Connection[];
  /** Callback to replace an entire connection at an index */
  onConnectionReplace?: (index: number, connection: Connection) => void;
  /** Callback to remove a connection by index */
  onRemoveConnection: (index: number) => void;
  /** Default project to populate when a connection has no project set (API omits it for same-project) */
  defaultProject?: string;
}

export interface UseConnectionEditBufferResult {
  /** Currently editing row info, or null if not editing */
  editingRow: ConnectionEditingRowState | null;
  /** Buffer holding uncommitted changes */
  editBuffer: Connection | null;
  /** Whether any row is currently being edited */
  isAnyRowEditing: boolean;
  /** Whether the current buffer is valid (all required fields filled) */
  isBufferValid: boolean;
  /** Check if a specific row is being edited */
  isRowEditing: (index: number) => boolean;
  /** Start editing an existing connection row */
  startEdit: (index: number) => void;
  /** Start editing a new connection row */
  startNew: (index: number, initialConnection?: Connection) => void;
  /** Apply buffered changes to parent state */
  applyEdit: () => void;
  /** Cancel editing and discard buffer (removes new rows) */
  cancelEdit: () => void;
  /** Update a field in the edit buffer (does not commit to parent) */
  updateBuffer: (field: keyof Connection, value: any) => void;
  /** Update a nested field in envBindings */
  updateBufferEnvBindings: (field: string, value: string) => void;
  /** Set the entire buffer (useful for complex updates) */
  setBuffer: (connection: Connection) => void;
  /** Clear edit state without side effects (used when row is deleted externally) */
  clearEditState: () => void;
}

/**
 * Check if a connection is truly empty (no data entered at all)
 */
function isConnectionEmpty(connection: Connection | undefined | null): boolean {
  if (!connection) return true;
  return !connection.component && !connection.endpoint;
}

/**
 * Check if a connection is valid (all required fields filled)
 */
function isConnectionValid(connection: Connection | undefined | null): boolean {
  if (!connection) return false;
  return !!(
    connection.component &&
    connection.endpoint &&
    connection.visibility
  );
}

/**
 * Hook for managing single-row editing of connections with a local buffer.
 *
 * This hook implements a pattern where:
 * - Only one row can be edited at a time
 * - Changes are buffered locally until Apply is clicked
 * - Cancel discards the buffer (and removes new rows)
 * - Apply commits the buffer to parent state
 */
export function useConnectionEditBuffer(
  options: UseConnectionEditBufferOptions,
): UseConnectionEditBufferResult {
  const {
    connections,
    onConnectionReplace,
    onRemoveConnection,
    defaultProject,
  } = options;

  // Track which row is currently being edited (only one at a time)
  const [editingRow, setEditingRow] =
    useState<ConnectionEditingRowState | null>(null);

  // Buffer for edits - changes are stored here until Apply is clicked
  const [editBuffer, setEditBuffer] = useState<Connection | null>(null);

  const isAnyRowEditing = editingRow !== null;
  const isBufferValid = isConnectionValid(editBuffer);

  const isRowEditing = useCallback(
    (index: number): boolean => {
      return editingRow?.index === index;
    },
    [editingRow],
  );

  // Start editing an existing row - initialize buffer with current values
  const startEdit = useCallback(
    (index: number) => {
      const connection = connections[index];
      // Deep copy to buffer for editing
      const buffer: Connection = connection
        ? JSON.parse(JSON.stringify(connection))
        : {
            component: '',
            endpoint: '',
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
    [connections, defaultProject],
  );

  // Start editing a new row - optionally pre-fill with initial values
  const startNew = useCallback(
    (index: number, initialConnection?: Connection) => {
      const buffer: Connection = initialConnection
        ? JSON.parse(JSON.stringify(initialConnection))
        : {
            component: '',
            endpoint: '',
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
    if (isConnectionEmpty(editBuffer)) {
      onRemoveConnection(index);
      setEditBuffer(null);
      setEditingRow(null);
      return;
    }

    // Don't commit invalid buffers — keep the row editable so the user can fix it
    if (!isConnectionValid(editBuffer)) {
      return;
    }

    if (onConnectionReplace) {
      onConnectionReplace(index, editBuffer);
    }

    setEditBuffer(null);
    setEditingRow(null);
  }, [editingRow, editBuffer, onConnectionReplace, onRemoveConnection]);

  // Cancel editing - discards buffer, removes new rows
  const cancelEdit = useCallback(() => {
    if (!editingRow) return;

    if (editingRow.isNew) {
      // NEW row: Cancel = Delete the row entirely
      onRemoveConnection(editingRow.index);
    }
    // For existing rows: just discard buffer, original values are still in connections prop

    setEditBuffer(null);
    setEditingRow(null);
  }, [editingRow, onRemoveConnection]);

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
  const setBuffer = useCallback((connection: Connection) => {
    setEditBuffer(connection);
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
