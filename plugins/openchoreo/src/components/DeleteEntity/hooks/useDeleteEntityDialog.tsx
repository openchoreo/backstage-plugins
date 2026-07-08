import { useCallback, useState } from 'react';
import { useApi, alertApiRef } from '@backstage/core-plugin-api';
import { Entity } from '@backstage/catalog-model';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { isForbiddenError, getErrorMessage } from '../../../utils/errorUtils';
import { DeleteEntityDialog } from '../components';
import {
  getEntityDeleteCascadeNote,
  getEntityDisplayType,
  performEntityDelete,
} from './deleteEntityDispatch';

export interface UseDeleteEntityDialogOptions {
  /**
   * Called after an entity has been successfully marked for deletion. Use it
   * to refresh the surrounding list (the deleted row stays visible with a
   * "marked for deletion" badge until the next catalog sync removes it).
   */
  onDeleted?: (entity: Entity) => void;
}

export interface UseDeleteEntityDialogResult {
  /** Open the confirmation dialog for the given entity. */
  requestDelete: (entity: Entity) => void;
  /** Render once in the surrounding component; controlled internally. */
  DeleteDialog: React.FC;
}

/**
 * Delete an entity from a listing (the catalog "All ..." pages, the project's
 * Project Contents table, the namespace projects/resources cards) without
 * leaving the page.
 *
 * Unlike {@link useDeleteEntityMenuItems} — which is bound to a single entity
 * via EntityLayout's context menu and navigates to `/catalog` on success — this
 * hook is list-oriented: a single dialog instance is reused across rows
 * (`requestDelete(entity)` targets one), and on success it calls `onDeleted`
 * (typically an optimistic mark + refetch) instead of navigating away. It
 * supports every kind {@link performEntityDelete} can dispatch: components,
 * projects, namespaces and the platform resource kinds.
 */
export function useDeleteEntityDialog(
  options?: UseDeleteEntityDialogOptions,
): UseDeleteEntityDialogResult {
  const { onDeleted } = options ?? {};
  const openChoreoClient = useApi(openChoreoClientApiRef);
  const alertApi = useApi(alertApiRef);

  const [target, setTarget] = useState<Entity | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestDelete = useCallback((entity: Entity) => {
    setTarget(entity);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    if (deleting) {
      return;
    }
    setTarget(null);
    setError(null);
  }, [deleting]);

  const handleConfirm = useCallback(async () => {
    if (!target) {
      return;
    }
    const entityName = target.metadata.name;
    const displayType = getEntityDisplayType(target.kind);
    setDeleting(true);
    setError(null);

    try {
      await performEntityDelete(openChoreoClient, target);

      alertApi.post({
        message: `${displayType} "${entityName}" has been marked for deletion`,
        severity: 'success',
        display: 'transient',
      });

      setTarget(null);
      onDeleted?.(target);
    } catch (err) {
      const errorMessage = isForbiddenError(err)
        ? `You do not have permission to delete this ${displayType.toLowerCase()}. Contact your administrator.`
        : getErrorMessage(err);
      setError(errorMessage);
      alertApi.post({ message: errorMessage, severity: 'error' });
    } finally {
      setDeleting(false);
    }
  }, [target, openChoreoClient, alertApi, onDeleted]);

  const DeleteDialog: React.FC = useCallback(
    () => (
      <DeleteEntityDialog
        open={target !== null}
        entityDisplayType={target ? getEntityDisplayType(target.kind) : ''}
        entityName={target?.metadata.name ?? ''}
        deleting={deleting}
        error={error}
        cascadeNote={
          target ? getEntityDeleteCascadeNote(target.kind) : undefined
        }
        onClose={handleClose}
        onConfirm={handleConfirm}
      />
    ),
    [target, deleting, error, handleClose, handleConfirm],
  );

  return { requestDelete, DeleteDialog };
}
