import { useCallback } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { dialogApiRef } from '@backstage/frontend-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { isOpenChoreoManagedEntity } from '@openchoreo/backstage-plugin-common';
import { EditAnnotationsDialog } from './EditAnnotationsDialog';

/**
 * `useProps` implementation for the `editAnnotationsEntityContextMenuItem`
 * NFS blueprint. Mirrors the legacy `useAnnotationEditorMenuItems` hook, but
 * opens `EditAnnotationsDialog` via `dialogApiRef` instead of hosting it in
 * the caller's component tree.
 */
export function useAnnotationEditorContextMenuItemProps(): {
  title: string;
  onClick: () => void;
} {
  const { entity } = useEntity();
  const dialogApi = useApi(dialogApiRef);
  const openDialog = useCallback(() => {
    dialogApi.open(({ dialog }) => (
      <EditAnnotationsDialog
        open
        onClose={() => dialog.close()}
        entity={entity}
      />
    ));
  }, [dialogApi, entity]);
  return { title: 'Edit Annotations', onClick: openDialog };
}

/**
 * Filter predicate for `editAnnotationsEntityContextMenuItem`. Only managed
 * OpenChoreo entities can have their annotations edited.
 */
export const isEditableAnnotationsEntity = isOpenChoreoManagedEntity;
