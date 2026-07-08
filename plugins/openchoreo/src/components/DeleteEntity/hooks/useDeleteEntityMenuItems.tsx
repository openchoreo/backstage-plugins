import { useState, useCallback, useMemo } from 'react';
import DeleteIcon from '@material-ui/icons/Delete';
import { useNavigate } from 'react-router-dom';
import { useApi, alertApiRef, IconComponent } from '@backstage/core-plugin-api';
import { Entity } from '@backstage/catalog-model';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { isForbiddenError, getErrorMessage } from '../../../utils/errorUtils';
import { isMarkedForDeletion } from '../utils';
import { DeleteEntityDialog } from '../components';
import {
  getEntityDeleteCascadeNote,
  getEntityDisplayType,
  isDeletableEntityKind,
  performEntityDelete,
} from './deleteEntityDispatch';

interface ExtraContextMenuItem {
  title: string;
  Icon: IconComponent;
  onClick: () => void;
  disabled?: boolean;
  tooltip?: string;
}

interface UseDeleteEntityMenuItemsResult {
  extraMenuItems: ExtraContextMenuItem[];
  DeleteConfirmationDialog: React.FC;
}

export interface DeletePermissionInfo {
  canDelete: boolean;
  loading: boolean;
  deniedTooltip: string;
}

/**
 * Hook that provides delete menu items for EntityLayout's extraContextMenuItems.
 *
 * Supports component, project (system), namespace (domain), and all platform
 * resource kinds. When `deletePermission` is provided and `canDelete` is false,
 * the menu item is shown disabled with a tooltip. For component/project/domain
 * kinds (no upfront permission check), a 403 is handled in the confirmation dialog.
 */
export function useDeleteEntityMenuItems(
  entity: Entity,
  deletePermission?: DeletePermissionInfo,
): UseDeleteEntityMenuItemsResult {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openChoreoClient = useApi(openChoreoClientApiRef);
  const alertApi = useApi(alertApiRef);
  const navigate = useNavigate();

  const entityKind = entity.kind.toLowerCase();
  const entityName = entity.metadata.name;
  const entityDisplayType = getEntityDisplayType(entityKind);

  const alreadyMarkedForDeletion = isMarkedForDeletion(entity);
  const canDelete =
    isDeletableEntityKind(entityKind) && !alreadyMarkedForDeletion;

  const handleOpenDialog = useCallback(() => {
    setDialogOpen(true);
    setError(null);
  }, []);

  const handleCloseDialog = useCallback(() => {
    if (!deleting) {
      setDialogOpen(false);
      setError(null);
    }
  }, [deleting]);

  const handleConfirmDelete = useCallback(async () => {
    setDeleting(true);
    setError(null);

    try {
      await performEntityDelete(openChoreoClient, entity);

      alertApi.post({
        message: `${entityDisplayType} "${entityName}" has been marked for deletion`,
        severity: 'success',
        display: 'transient',
      });

      setDialogOpen(false);
      navigate('/catalog');
    } catch (err) {
      const errorMessage = isForbiddenError(err)
        ? 'You do not have permission to delete this resource. Contact your administrator.'
        : getErrorMessage(err);
      setError(errorMessage);
      alertApi.post({
        message: errorMessage,
        severity: 'error',
      });
    } finally {
      setDeleting(false);
    }
  }, [
    entity,
    entityName,
    entityDisplayType,
    openChoreoClient,
    alertApi,
    navigate,
  ]);

  const extraMenuItems = useMemo<ExtraContextMenuItem[]>(() => {
    if (!canDelete) {
      return [];
    }

    // If deletePermission is provided and still loading, don't show the item yet
    if (deletePermission?.loading) {
      return [];
    }

    // If deletePermission is provided and denied, show disabled item with tooltip
    if (deletePermission && !deletePermission.canDelete) {
      return [
        {
          title: `Delete ${entityDisplayType}`,
          Icon: DeleteIcon as IconComponent,
          onClick: () => {},
          disabled: true,
          tooltip: deletePermission.deniedTooltip,
        },
      ];
    }

    return [
      {
        title: `Delete ${entityDisplayType}`,
        Icon: DeleteIcon as IconComponent,
        onClick: handleOpenDialog,
      },
    ];
  }, [canDelete, entityDisplayType, handleOpenDialog, deletePermission]);

  const cascadeNote = useMemo(
    () => getEntityDeleteCascadeNote(entityKind),
    [entityKind],
  );

  const DeleteConfirmationDialog: React.FC = useCallback(
    () => (
      <DeleteEntityDialog
        open={dialogOpen}
        entityDisplayType={entityDisplayType}
        entityName={entityName}
        deleting={deleting}
        error={error}
        cascadeNote={cascadeNote}
        onClose={handleCloseDialog}
        onConfirm={handleConfirmDelete}
      />
    ),
    [
      dialogOpen,
      handleCloseDialog,
      handleConfirmDelete,
      entityDisplayType,
      entityName,
      cascadeNote,
      error,
      deleting,
    ],
  );

  return {
    extraMenuItems,
    DeleteConfirmationDialog,
  };
}
