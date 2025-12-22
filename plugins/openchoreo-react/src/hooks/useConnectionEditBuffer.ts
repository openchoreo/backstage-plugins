import { useState, useCallback } from 'react';
import type { Connection } from '@openchoreo/backstage-plugin-common';

/** Tracks which connection row is currently being edited */
export interface ConnectionEditingRowState {
  connectionName: string;
  isNew?: boolean;
}

export interface UseConnectionEditBufferOptions {
  /** Connection data to reference when starting edits */
  connections: { [key: string]: Connection };
  /** Callback to replace an entire connection at once (preferred to avoid race conditions) */
  onConnectionReplace?: (
    connectionName: string,
    connection: Connection,
  ) => void;
  /** Callback to remove a connection */
  onRemoveConnection: (connectionName: string) => void;
}

export interface UseConnectionEditBufferResult {
  /** Currently editing row info, or null if not editing */
  editingRow: ConnectionEditingRowState | null;
  /** Buffer holding uncommitted changes */
  editBuffer: Connection | null;
  /** Buffered connection name (for rename support) */
  editBufferName: string | null;
  /** Whether any row is currently being edited */
  isAnyRowEditing: boolean;
  /** Whether the current buffer is valid (all required fields filled) */
  isBufferValid: boolean;
  /** Check if a specific row is being edited */
  isRowEditing: (connectionName: string) => boolean;
  /** Start editing an existing connection row */
  startEdit: (connectionName: string) => void;
  /** Start editing a new connection row */
  startNew: (connectionName: string, initialConnection?: Connection) => void;
  /** Apply buffered changes to parent state */
  applyEdit: () => void;
  /** Cancel editing and discard buffer (removes new rows) */
  cancelEdit: () => void;
  /** Update a field in the edit buffer (does not commit to parent) */
  updateBuffer: (field: keyof Connection, value: any) => void;
  /** Update the connection name in the buffer */
  updateBufferName: (name: string) => void;
  /** Update a nested field in params */
  updateBufferParams: (field: string, value: string) => void;
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
  return (
    !connection.type &&
    !connection.params?.componentName &&
    !connection.params?.endpoint &&
    !connection.params?.projectName
  );
}

/**
 * Check if a connection is valid (all required fields filled)
 */
function isConnectionValid(connection: Connection | undefined | null): boolean {
  if (!connection) return false;
  return !!(
    connection.type &&
    connection.params?.componentName &&
    connection.params?.endpoint &&
    connection.params?.projectName
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
 *
 * @example
 * ```tsx
 * const editBuffer = useConnectionEditBuffer({
 *   connections,
 *   onConnectionReplace,
 *   onRemoveConnection,
 * });
 *
 * // In render
 * <ConnectionEditor
 *   isEditing={editBuffer.isRowEditing(connectionName)}
 *   connection={editBuffer.isRowEditing(connectionName) ? editBuffer.editBuffer : connection}
 *   onEdit={() => editBuffer.startEdit(connectionName)}
 *   onApply={editBuffer.applyEdit}
 *   onCancel={editBuffer.cancelEdit}
 *   onChange={editBuffer.updateBuffer}
 * />
 * ```
 */
export function useConnectionEditBuffer(
  options: UseConnectionEditBufferOptions,
): UseConnectionEditBufferResult {
  const { connections, onConnectionReplace, onRemoveConnection } = options;

  // Track which row is currently being edited (only one at a time)
  const [editingRow, setEditingRow] =
    useState<ConnectionEditingRowState | null>(null);

  // Buffer for edits - changes are stored here until Apply is clicked
  const [editBuffer, setEditBuffer] = useState<Connection | null>(null);

  // Buffer for the connection name (to support renaming)
  const [editBufferName, setEditBufferName] = useState<string | null>(null);

  const isAnyRowEditing = editingRow !== null;
  const isBufferValid = isConnectionValid(editBuffer);

  const isRowEditing = useCallback(
    (connectionName: string): boolean => {
      return editingRow?.connectionName === connectionName;
    },
    [editingRow],
  );

  // Start editing an existing row - initialize buffer with current values
  const startEdit = useCallback(
    (connectionName: string) => {
      const connection = connections[connectionName];
      // Deep copy to buffer for editing
      setEditBuffer(
        connection
          ? JSON.parse(JSON.stringify(connection))
          : {
              type: '',
              params: { componentName: '', endpoint: '', projectName: '' },
              inject: { env: [] },
            },
      );
      setEditBufferName(connectionName);
      setEditingRow({
        connectionName,
        isNew: false,
      });
    },
    [connections],
  );

  // Start editing a new row - optionally pre-fill with initial values
  const startNew = useCallback(
    (connectionName: string, initialConnection?: Connection) => {
      setEditBuffer(
        initialConnection
          ? JSON.parse(JSON.stringify(initialConnection))
          : {
              type: '',
              params: { componentName: '', endpoint: '', projectName: '' },
              inject: { env: [] },
            },
      );
      setEditBufferName(connectionName);
      setEditingRow({
        connectionName,
        isNew: true,
      });
    },
    [],
  );

  // Apply buffered changes - commits buffer to parent state
  const applyEdit = useCallback(() => {
    if (!editingRow || !editBuffer || !editBufferName) return;

    const { connectionName } = editingRow;

    // If buffer is empty, remove the row
    if (isConnectionEmpty(editBuffer)) {
      onRemoveConnection(connectionName);
      setEditBuffer(null);
      setEditBufferName(null);
      setEditingRow(null);
      return;
    }

    // If name changed and this is not a new connection, we need to handle rename
    const nameChanged = connectionName !== editBufferName;

    if (onConnectionReplace) {
      if (nameChanged && !editingRow.isNew) {
        // Remove old and add new
        onRemoveConnection(connectionName);
      }
      onConnectionReplace(editBufferName, editBuffer);
    }

    setEditBuffer(null);
    setEditBufferName(null);
    setEditingRow(null);
  }, [
    editingRow,
    editBuffer,
    editBufferName,
    onConnectionReplace,
    onRemoveConnection,
  ]);

  // Cancel editing - discards buffer, removes new rows
  const cancelEdit = useCallback(() => {
    if (!editingRow) return;

    if (editingRow.isNew) {
      // NEW row: Cancel = Delete the row entirely
      onRemoveConnection(editingRow.connectionName);
    }
    // For existing rows: just discard buffer, original values are still in connections prop

    setEditBuffer(null);
    setEditBufferName(null);
    setEditingRow(null);
  }, [editingRow, onRemoveConnection]);

  // Clear edit state without any side effects (used when row is deleted externally)
  const clearEditState = useCallback(() => {
    setEditBuffer(null);
    setEditBufferName(null);
    setEditingRow(null);
  }, []);

  // Update a single field in the buffer
  const updateBuffer = useCallback((field: keyof Connection, value: any) => {
    setEditBuffer(prev => (prev ? { ...prev, [field]: value } : null));
  }, []);

  // Update the connection name in the buffer
  const updateBufferName = useCallback((name: string) => {
    setEditBufferName(name);
  }, []);

  // Update a nested field in params
  const updateBufferParams = useCallback((field: string, value: string) => {
    setEditBuffer(prev =>
      prev
        ? {
            ...prev,
            params: { ...prev.params, [field]: value },
          }
        : null,
    );
  }, []);

  // Set the entire buffer
  const setBuffer = useCallback((connection: Connection) => {
    setEditBuffer(connection);
  }, []);

  return {
    editingRow,
    editBuffer,
    editBufferName,
    isAnyRowEditing,
    isBufferValid,
    isRowEditing,
    startEdit,
    startNew,
    applyEdit,
    cancelEdit,
    updateBuffer,
    updateBufferName,
    updateBufferParams,
    setBuffer,
    clearEditState,
  };
}
