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
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { isForbiddenError, getErrorMessage } from '../../../utils/errorUtils';
import { useStyles } from '../styles';
import { isMarkedForDeletion } from '../utils';
import {
  isSupportedKind,
  mapKindToApiKind,
} from '../../ResourceDefinition/utils';

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

/** Human-friendly display names for all deletable entity kinds */
const KIND_DISPLAY_NAMES: Record<string, string> = {
  component: 'Component',
  system: 'Project',
  domain: 'Namespace',
  environment: 'Environment',
  dataplane: 'Dataplane',
  clusterdataplane: 'Cluster Data Plane',
  buildplane: 'Build Plane',
  clusterbuildplane: 'Cluster Build Plane',
  observabilityplane: 'Observability Plane',
  clusterobservabilityplane: 'Cluster Observability Plane',
  deploymentpipeline: 'Deployment Pipeline',
  componenttype: 'Component Type',
  clustercomponenttype: 'Cluster Component Type',
  traittype: 'Trait Type',
  clustertraittype: 'Cluster Trait Type',
  workflow: 'Workflow',
  clusterworkflow: 'Cluster Workflow',
  componentworkflow: 'Component Workflow',
};

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
  const classes = useStyles();

  const entityKind = entity.kind.toLowerCase();
  const entityName = entity.metadata.name;
  const isComponent = entityKind === 'component';
  const isProject = entityKind === 'system';
  const isDomain = entityKind === 'domain';
  const isPlatformResource = isSupportedKind(entityKind);

  const entityDisplayType = KIND_DISPLAY_NAMES[entityKind] ?? entityKind;

  const alreadyMarkedForDeletion = isMarkedForDeletion(entity);
  const isDeletableKind =
    isComponent || isProject || isDomain || isPlatformResource;
  const canDelete = isDeletableKind && !alreadyMarkedForDeletion;

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
      } else if (isDomain) {
        await openChoreoClient.deleteNamespace(entity);
      } else if (isPlatformResource) {
        const apiKind = mapKindToApiKind(entityKind);
        const namespace =
          entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] ?? '';
        await openChoreoClient.deleteResourceDefinition(
          apiKind,
          namespace,
          entityName,
        );
      } else {
        throw new Error(`Unsupported entity kind for deletion: ${entityKind}`);
      }

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
    entityKind,
    entityName,
    entityDisplayType,
    isComponent,
    isProject,
    isDomain,
    isPlatformResource,
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

          {isDomain && (
            <Typography variant="h5">
              Note: All projects and components within this namespace will also
              be deleted.
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
      isDomain,
      error,
      deleting,
    ],
  );

  return {
    extraMenuItems,
    DeleteConfirmationDialog,
  };
}
