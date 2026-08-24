import { useCallback, useState } from 'react';
import type { Entity } from '@backstage/catalog-model';
import { useApi, alertApiRef } from '@backstage/core-plugin-api';
import { dialogApiRef } from '@backstage/frontend-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useNavigate } from 'react-router-dom';
import { useResourceDefinitionPermission } from '@openchoreo/backstage-plugin-react';
import { isOpenChoreoManagedEntity } from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { isForbiddenError, getErrorMessage } from '../../../utils/errorUtils';
import { isMarkedForDeletion } from '../utils';
import { isSupportedKind } from '../../ResourceDefinition/utils';
import { DeleteEntityDialog } from '../components';
import {
  getEntityDeleteCascadeNote,
  getEntityDisplayType,
  isDeletableEntityKind,
  performEntityDelete,
} from './deleteEntityDispatch';

/**
 * Hosted delete-confirmation flow used by the NFS
 * `deleteEntityContextMenuItem` blueprint. Owns the deleting/error state
 * that the presentational `DeleteEntityDialog` requires — the caller
 * (`dialogApi.open(...)`) just renders this component once and closes via
 * the dialog handle.
 */
function DeleteEntityBlueprintDialog({
  entity,
  onClose,
}: {
  entity: Entity;
  onClose: () => void;
}) {
  const openChoreoClient = useApi(openChoreoClientApiRef);
  const alertApi = useApi(alertApiRef);
  const navigate = useNavigate();

  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entityKind = entity.kind.toLowerCase();
  const entityName = entity.metadata.name;
  const entityDisplayType = getEntityDisplayType(entityKind);
  const cascadeNote = getEntityDeleteCascadeNote(entityKind);

  const handleClose = useCallback(() => {
    if (!deleting) onClose();
  }, [deleting, onClose]);

  const handleConfirm = useCallback(async () => {
    setDeleting(true);
    setError(null);
    try {
      await performEntityDelete(openChoreoClient, entity);
      alertApi.post({
        message: `${entityDisplayType} "${entityName}" has been marked for deletion`,
        severity: 'success',
        display: 'transient',
      });
      onClose();
      navigate('/catalog');
    } catch (err) {
      const errorMessage = isForbiddenError(err)
        ? 'You do not have permission to delete this resource. Contact your administrator.'
        : getErrorMessage(err);
      setError(errorMessage);
      alertApi.post({ message: errorMessage, severity: 'error' });
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
    onClose,
  ]);

  return (
    <DeleteEntityDialog
      open
      entityDisplayType={entityDisplayType}
      entityName={entityName}
      deleting={deleting}
      error={error}
      cascadeNote={cascadeNote}
      onClose={handleClose}
      onConfirm={handleConfirm}
    />
  );
}

/**
 * `useProps` implementation for the `deleteEntityContextMenuItem` NFS
 * blueprint. Opens `DeleteEntityDialog` via `dialogApiRef` so the
 * blueprint's rendered `MenuItem` doesn't have to host the dialog inline.
 *
 * Delete lifecycle (state + API call + navigation) lives in
 * `DeleteEntityBlueprintDialog` above. Both this path and the legacy
 * `useDeleteEntityMenuItems` route through `performEntityDelete` /
 * `DeleteEntityDialog`, so behaviour is identical either way.
 *
 * Permission for platform-resource kinds is checked here (canonical
 * `EntityContextMenuItemBlueprint` `useProps` is called inside the entity
 * scope, so `useEntity` and permission hooks are safe). For non-platform
 * kinds (component / system / domain), no upfront permission check
 * happens — a 403 surfaces in the confirmation dialog like today.
 */
export function useDeleteEntityContextMenuItemProps():
  | { title: string; onClick: () => void; disabled?: boolean }
  | { title: string; onClick: () => void; disabled: true } {
  const { entity } = useEntity();
  const dialogApi = useApi(dialogApiRef);
  const { canDelete: permCanDelete, loading: permLoading } =
    useResourceDefinitionPermission();

  const entityKind = entity.kind.toLowerCase();
  const entityDisplayType = getEntityDisplayType(entityKind);
  const isPlatformResource = isSupportedKind(entityKind);

  const openDialog = useCallback(() => {
    dialogApi.open(({ dialog }) => (
      <DeleteEntityBlueprintDialog
        entity={entity}
        onClose={() => dialog.close()}
      />
    ));
  }, [dialogApi, entity]);

  if (isPlatformResource && permLoading) {
    return {
      title: `Delete ${entityDisplayType}`,
      onClick: () => {},
      disabled: true,
    };
  }
  if (isPlatformResource && !permCanDelete) {
    return {
      title: `Delete ${entityDisplayType}`,
      onClick: () => {},
      disabled: true,
    };
  }
  return { title: `Delete ${entityDisplayType}`, onClick: openDialog };
}

/**
 * Filter predicate for `deleteEntityContextMenuItem`. Requires the
 * `openchoreo.io/managed=true` label + a kind the OC API can delete + not
 * already marked for deletion. Runtime `useProps` layers the permission
 * check on top.
 */
export function isDeletableOpenChoreoEntity(entity: Entity) {
  if (!isOpenChoreoManagedEntity(entity)) return false;
  if (!isDeletableEntityKind(entity.kind)) return false;
  return !isMarkedForDeletion(entity);
}
