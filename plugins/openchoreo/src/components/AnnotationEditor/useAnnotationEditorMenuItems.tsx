import { useState, useCallback, useMemo } from 'react';
import EditIcon from '@material-ui/icons/Edit';
import { IconComponent } from '@backstage/core-plugin-api';
import { Entity } from '@backstage/catalog-model';
import { CHOREO_LABELS } from '@openchoreo/backstage-plugin-common';
import { EditAnnotationsDialog } from './EditAnnotationsDialog';

interface ExtraContextMenuItem {
  title: string;
  Icon: IconComponent;
  onClick: () => void;
}

interface UseAnnotationEditorMenuItemsResult {
  extraMenuItems: ExtraContextMenuItem[];
  EditAnnotationsDialog: React.FC;
}

/**
 * Hook that provides annotation editor menu items for EntityLayout's UNSTABLE_extraContextMenuItems.
 *
 * Only enabled for managed OpenChoreo entities (Component and System kinds).
 *
 * Usage:
 * ```tsx
 * function MyEntityLayout({ children }) {
 *   const { entity } = useEntity();
 *   const { extraMenuItems, EditAnnotationsDialog } = useAnnotationEditorMenuItems(entity);
 *
 *   return (
 *     <>
 *       <EntityLayout UNSTABLE_extraContextMenuItems={extraMenuItems}>
 *         {children}
 *       </EntityLayout>
 *       <EditAnnotationsDialog />
 *     </>
 *   );
 * }
 * ```
 */
export function useAnnotationEditorMenuItems(
  entity: Entity,
): UseAnnotationEditorMenuItemsResult {
  const [dialogOpen, setDialogOpen] = useState(false);

  const entityKind = entity.kind.toLowerCase();
  const isManaged = entity.metadata.labels?.[CHOREO_LABELS.MANAGED] === 'true';
  const canEdit =
    isManaged && (entityKind === 'component' || entityKind === 'system');

  const handleOpenDialog = useCallback(() => {
    setDialogOpen(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
  }, []);

  const extraMenuItems = useMemo<ExtraContextMenuItem[]>(() => {
    if (!canEdit) {
      return [];
    }

    return [
      {
        title: 'Edit Annotations',
        Icon: EditIcon as IconComponent,
        onClick: handleOpenDialog,
      },
    ];
  }, [canEdit, handleOpenDialog]);

  const AnnotationsDialog: React.FC = useCallback(
    () => (
      <EditAnnotationsDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        entity={entity}
      />
    ),
    [dialogOpen, handleCloseDialog, entity],
  );

  return {
    extraMenuItems,
    EditAnnotationsDialog: AnnotationsDialog,
  };
}
