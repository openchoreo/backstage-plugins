import { useState, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  CircularProgress,
} from '@material-ui/core';
import DeleteIcon from '@material-ui/icons/Delete';
import { useNavigate } from 'react-router-dom';
import { useApi, alertApiRef, IconComponent } from '@backstage/core-plugin-api';
import { Entity } from '@backstage/catalog-model';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { useStyles } from '../styles';
import { isMarkedForDeletion } from '../utils';

interface ExtraContextMenuItem {
  title: string;
  Icon: IconComponent;
  onClick: () => void;
}

interface UseDeleteEntityMenuItemsResult {
  extraMenuItems: ExtraContextMenuItem[];
  DeleteConfirmationDialog: React.FC;
}

/**
 * Hook that provides delete menu items for EntityLayout's UNSTABLE_extraContextMenuItems.
 *
 * Usage in EntityPage:
 * ```tsx
 * function MyEntityLayout({ children }) {
 *   const { entity } = useEntity();
 *   const { extraMenuItems, DeleteConfirmationDialog } = useDeleteEntityMenuItems(entity);
 *
 *   return (
 *     <>
 *       <EntityLayout UNSTABLE_extraContextMenuItems={extraMenuItems}>
 *         {children}
 *       </EntityLayout>
 *       <DeleteConfirmationDialog />
 *     </>
 *   );
 * }
 * ```
 */
export function useDeleteEntityMenuItems(
  entity: Entity,
): UseDeleteEntityMenuItemsResult {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openChoreoClient = useApi(openChoreoClientApiRef);
  const alertApi = useApi(alertApiRef);
  const navigate = useNavigate();
  const classes = useStyles();

  const entityKind = entity.kind.toLowerCase();
  const entityName = entity.metadata.name;
  const isComponent = entityKind === 'component';
  const isProject = entityKind === 'system'; // Projects are represented as System entities

  const getEntityDisplayType = () => {
    if (isComponent) return 'Component';
    if (isProject) return 'Project';
    return entityKind;
  };
  const entityDisplayType = getEntityDisplayType();

  const alreadyMarkedForDeletion = isMarkedForDeletion(entity);
  const canDelete = (isComponent || isProject) && !alreadyMarkedForDeletion;

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
      if (isComponent) {
        await openChoreoClient.deleteComponent(entity);
      } else if (isProject) {
        await openChoreoClient.deleteProject(entity);
      } else {
        throw new Error(`Unsupported entity kind for deletion: ${entityKind}`);
      }

      alertApi.post({
        message: `${entityDisplayType} "${entityName}" has been marked for deletion`,
        severity: 'success',
        display: 'transient',
      });

      setDialogOpen(false);
      // Navigate to catalog after successful deletion
      navigate('/catalog');
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      alertApi.post({
        message: `Failed to delete ${entityDisplayType.toLowerCase()}: ${errorMessage}`,
        severity: 'error',
      });
    } finally {
      setDeleting(false);
    }
  }, [
    entity,
    entityKind,
    entityName,
    entityDisplayType,
    isComponent,
    isProject,
    openChoreoClient,
    alertApi,
    navigate,
  ]);

  const extraMenuItems = useMemo<ExtraContextMenuItem[]>(() => {
    if (!canDelete) {
      return [];
    }

    return [
      {
        title: `Delete ${entityDisplayType}`,
        Icon: DeleteIcon as IconComponent,
        onClick: handleOpenDialog,
      },
    ];
  }, [canDelete, entityDisplayType, handleOpenDialog]);

  const DeleteConfirmationDialog: React.FC = useCallback(
    () => (
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        aria-labelledby="delete-entity-dialog-title"
      >
        <DialogTitle id="delete-entity-dialog-title" disableTypography>
          <Typography variant="h4">Delete {entityDisplayType}</Typography>
        </DialogTitle>

        <DialogContent className={classes.deleteDialogContent}>
          <Typography variant="body1">
            Are you sure you want to delete the{' '}
            {entityDisplayType.toLowerCase()}{' '}
            <span className={classes.entityName}>{entityName}</span>?
          </Typography>

          <Typography variant="body2" className={classes.warningText}>
            This action cannot be undone. The {entityDisplayType.toLowerCase()}{' '}
            and all its associated resources will be permanently deleted.
          </Typography>

          {isProject && (
            <Typography variant="h5">
              Note: All components within this project will also be deleted.
            </Typography>
          )}

          {error && (
            <Typography variant="body2" color="error">
              Error: {error}
            </Typography>
          )}
        </DialogContent>

        <DialogActions>
          <Button
            onClick={handleCloseDialog}
            disabled={deleting}
            variant="contained"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDelete}
            className={classes.deleteButton}
            variant="outlined"
            disabled={deleting}
            startIcon={
              deleting ? <CircularProgress size={16} color="inherit" /> : null
            }
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    ),
    [
      dialogOpen,
      handleCloseDialog,
      handleConfirmDelete,
      classes,
      entityDisplayType,
      entityName,
      isProject,
      error,
      deleting,
    ],
  );

  return {
    extraMenuItems,
    DeleteConfirmationDialog,
  };
}
