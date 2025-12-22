import { useState, useCallback } from 'react';
import type { WorkloadEndpoint } from '@openchoreo/backstage-plugin-common';

/** Tracks which endpoint row is currently being edited */
export interface EndpointEditingRowState {
  endpointName: string;
  isNew?: boolean;
}

export interface UseEndpointEditBufferOptions {
  /** Endpoint data to reference when starting edits */
  endpoints: { [key: string]: WorkloadEndpoint };
  /** Callback to replace an entire endpoint at once (preferred to avoid race conditions) */
  onEndpointReplace?: (
    endpointName: string,
    endpoint: WorkloadEndpoint,
  ) => void;
  /** Callback to remove an endpoint */
  onRemoveEndpoint: (endpointName: string) => void;
}

export interface UseEndpointEditBufferResult {
  /** Currently editing row info, or null if not editing */
  editingRow: EndpointEditingRowState | null;
  /** Buffer holding uncommitted changes */
  editBuffer: WorkloadEndpoint | null;
  /** Buffered endpoint name (for rename support) */
  editBufferName: string | null;
  /** Whether any row is currently being edited */
  isAnyRowEditing: boolean;
  /** Whether the current buffer is valid (all required fields filled) */
  isBufferValid: boolean;
  /** Check if a specific row is being edited */
  isRowEditing: (endpointName: string) => boolean;
  /** Start editing an existing endpoint row */
  startEdit: (endpointName: string) => void;
  /** Start editing a new endpoint row */
  startNew: (endpointName: string, initialEndpoint?: WorkloadEndpoint) => void;
  /** Apply buffered changes to parent state */
  applyEdit: () => void;
  /** Cancel editing and discard buffer (removes new rows) */
  cancelEdit: () => void;
  /** Update a field in the edit buffer (does not commit to parent) */
  updateBuffer: (field: keyof WorkloadEndpoint, value: any) => void;
  /** Update the endpoint name in the buffer */
  updateBufferName: (name: string) => void;
  /** Set the entire buffer (useful for complex updates) */
  setBuffer: (endpoint: WorkloadEndpoint) => void;
  /** Clear edit state without side effects (used when row is deleted externally) */
  clearEditState: () => void;
}

/**
 * Check if an endpoint is truly empty (no data entered at all)
 */
function isEndpointEmpty(
  endpoint: WorkloadEndpoint | undefined | null,
): boolean {
  if (!endpoint) return true;
  return !endpoint.type && (endpoint.port === undefined || endpoint.port <= 0);
}

/**
 * Check if an endpoint is valid (all required fields filled)
 */
function isEndpointValid(
  endpoint: WorkloadEndpoint | undefined | null,
): boolean {
  if (!endpoint) return false;
  return !!(endpoint.type && endpoint.port !== undefined && endpoint.port > 0);
}

/**
 * Hook for managing single-row editing of endpoints with a local buffer.
 *
 * This hook implements a pattern where:
 * - Only one row can be edited at a time
 * - Changes are buffered locally until Apply is clicked
 * - Cancel discards the buffer (and removes new rows)
 * - Apply commits the buffer to parent state
 *
 * @example
 * ```tsx
 * const editBuffer = useEndpointEditBuffer({
 *   endpoints,
 *   onEndpointReplace,
 *   onRemoveEndpoint,
 * });
 *
 * // In render
 * <EndpointEditor
 *   isEditing={editBuffer.isRowEditing(endpointName)}
 *   endpoint={editBuffer.isRowEditing(endpointName) ? editBuffer.editBuffer : endpoint}
 *   onEdit={() => editBuffer.startEdit(endpointName)}
 *   onApply={editBuffer.applyEdit}
 *   onCancel={editBuffer.cancelEdit}
 *   onChange={editBuffer.updateBuffer}
 * />
 * ```
 */
export function useEndpointEditBuffer(
  options: UseEndpointEditBufferOptions,
): UseEndpointEditBufferResult {
  const { endpoints, onEndpointReplace, onRemoveEndpoint } = options;

  // Track which row is currently being edited (only one at a time)
  const [editingRow, setEditingRow] = useState<EndpointEditingRowState | null>(
    null,
  );

  // Buffer for edits - changes are stored here until Apply is clicked
  const [editBuffer, setEditBuffer] = useState<WorkloadEndpoint | null>(null);

  // Buffer for the endpoint name (to support renaming)
  const [editBufferName, setEditBufferName] = useState<string | null>(null);

  const isAnyRowEditing = editingRow !== null;
  const isBufferValid = isEndpointValid(editBuffer);

  const isRowEditing = useCallback(
    (endpointName: string): boolean => {
      return editingRow?.endpointName === endpointName;
    },
    [editingRow],
  );

  // Start editing an existing row - initialize buffer with current values
  const startEdit = useCallback(
    (endpointName: string) => {
      const endpoint = endpoints[endpointName];
      // Deep copy to buffer for editing
      setEditBuffer(
        endpoint
          ? JSON.parse(JSON.stringify(endpoint))
          : { type: 'HTTP', port: 8080 },
      );
      setEditBufferName(endpointName);
      setEditingRow({
        endpointName,
        isNew: false,
      });
    },
    [endpoints],
  );

  // Start editing a new row - optionally pre-fill with initial values
  const startNew = useCallback(
    (endpointName: string, initialEndpoint?: WorkloadEndpoint) => {
      setEditBuffer(
        initialEndpoint
          ? JSON.parse(JSON.stringify(initialEndpoint))
          : { type: 'HTTP', port: 8080 },
      );
      setEditBufferName(endpointName);
      setEditingRow({
        endpointName,
        isNew: true,
      });
    },
    [],
  );

  // Apply buffered changes - commits buffer to parent state
  const applyEdit = useCallback(() => {
    if (!editingRow || !editBuffer || !editBufferName) return;

    const { endpointName } = editingRow;

    // If buffer is empty, remove the row
    if (isEndpointEmpty(editBuffer)) {
      onRemoveEndpoint(endpointName);
      setEditBuffer(null);
      setEditBufferName(null);
      setEditingRow(null);
      return;
    }

    // If name changed and this is not a new endpoint, we need to handle rename
    const nameChanged = endpointName !== editBufferName;

    if (onEndpointReplace) {
      if (nameChanged && !editingRow.isNew) {
        // Remove old and add new
        onRemoveEndpoint(endpointName);
      }
      onEndpointReplace(editBufferName, editBuffer);
    }

    setEditBuffer(null);
    setEditBufferName(null);
    setEditingRow(null);
  }, [
    editingRow,
    editBuffer,
    editBufferName,
    onEndpointReplace,
    onRemoveEndpoint,
  ]);

  // Cancel editing - discards buffer, removes new rows
  const cancelEdit = useCallback(() => {
    if (!editingRow) return;

    if (editingRow.isNew) {
      // NEW row: Cancel = Delete the row entirely
      onRemoveEndpoint(editingRow.endpointName);
    }
    // For existing rows: just discard buffer, original values are still in endpoints prop

    setEditBuffer(null);
    setEditBufferName(null);
    setEditingRow(null);
  }, [editingRow, onRemoveEndpoint]);

  // Clear edit state without any side effects (used when row is deleted externally)
  const clearEditState = useCallback(() => {
    setEditBuffer(null);
    setEditBufferName(null);
    setEditingRow(null);
  }, []);

  // Update a single field in the buffer
  const updateBuffer = useCallback(
    (field: keyof WorkloadEndpoint, value: any) => {
      setEditBuffer(prev => (prev ? { ...prev, [field]: value } : null));
    },
    [],
  );

  // Update the endpoint name in the buffer
  const updateBufferName = useCallback((name: string) => {
    setEditBufferName(name);
  }, []);

  // Set the entire buffer
  const setBuffer = useCallback((endpoint: WorkloadEndpoint) => {
    setEditBuffer(endpoint);
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
    setBuffer,
    clearEditState,
  };
}
