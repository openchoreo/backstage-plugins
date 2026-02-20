import { type ReactNode } from 'react';
import { Box } from '@material-ui/core';
import { useEntity } from '@backstage/plugin-catalog-react';
import { EmptyState, Progress } from '@backstage/core-components';
import {
  useDeleteEntityMenuItems,
  useEntityExistsCheck,
  useAnnotationEditorMenuItems,
} from '@openchoreo/backstage-plugin';
import { OpenChoreoEntityLayout } from '@openchoreo/backstage-plugin-react';

const KIND_DISPLAY_NAMES: Record<string, string> = {
  system: 'Project',
  domain: 'Namespace',
};

/**
 * Gets the display label for an entity kind.
 * Maps Backstage entity kinds to OpenChoreo terminology.
 */
function getEntityTypeLabel(kind: string): string {
  return KIND_DISPLAY_NAMES[kind.toLowerCase()] ?? kind;
}

/**
 * Wrapper component that adds delete menu functionality to OpenChoreoEntityLayout.
 * Children (OpenChoreoEntityLayout.Route elements) are passed through, keeping them
 * in static JSX so Backstage can discover routable extensions.
 *
 * Also checks if the entity exists in OpenChoreo:
 * - If not found (404), shows empty state with "Not Found" message
 * - If marked for deletion, shows empty state with "Marked for Deletion" message
 */
export function EntityLayoutWithDelete({ children }: { children: ReactNode }) {
  const { entity } = useEntity();
  const { extraMenuItems: deleteMenuItems, DeleteConfirmationDialog } =
    useDeleteEntityMenuItems(entity);
  const {
    extraMenuItems: annotationMenuItems,
    EditAnnotationsDialog: AnnotationEditorDialog,
  } = useAnnotationEditorMenuItems(entity);
  const { loading, status, message } = useEntityExistsCheck(entity);

  const extraMenuItems = [...annotationMenuItems, ...deleteMenuItems];

  // Get display label for the entity type
  const entityTypeLabel = getEntityTypeLabel(entity.kind);

  // Show loading state while checking entity status
  if (loading) {
    return <Progress />;
  }

  // Show empty state with header if entity not found in OpenChoreo
  if (status === 'not-found') {
    return (
      <OpenChoreoEntityLayout
        contextMenuOptions={{ disableUnregister: 'hidden' }}
        parentEntityRelations={['partOf']}
        kindDisplayNames={KIND_DISPLAY_NAMES}
      >
        <OpenChoreoEntityLayout.Route path="/" title="Overview">
          <Box py={4}>
            <EmptyState
              missing="data"
              title={`${entityTypeLabel} Not Found`}
              description={
                message ||
                `The ${entityTypeLabel.toLowerCase()} "${
                  entity.metadata.name
                }" could not be found in OpenChoreo. It may have been deleted.`
              }
            />
          </Box>
        </OpenChoreoEntityLayout.Route>
      </OpenChoreoEntityLayout>
    );
  }

  // Show empty state with header if entity is marked for deletion
  if (status === 'marked-for-deletion') {
    return (
      <OpenChoreoEntityLayout
        contextMenuOptions={{ disableUnregister: 'hidden' }}
        parentEntityRelations={['partOf']}
        kindDisplayNames={KIND_DISPLAY_NAMES}
      >
        <OpenChoreoEntityLayout.Route path="/" title="Overview">
          <Box py={4}>
            <EmptyState
              missing="data"
              title={`${entityTypeLabel} Marked for Deletion`}
              description={
                message ||
                `This ${entityTypeLabel.toLowerCase()} "${
                  entity.metadata.name
                }" is marked for deletion and will be permanently removed soon.`
              }
            />
          </Box>
        </OpenChoreoEntityLayout.Route>
      </OpenChoreoEntityLayout>
    );
  }

  return (
    <>
      <OpenChoreoEntityLayout
        contextMenuOptions={{ disableUnregister: 'hidden' }}
        extraContextMenuItems={extraMenuItems}
        parentEntityRelations={['partOf']}
        kindDisplayNames={KIND_DISPLAY_NAMES}
      >
        {children}
      </OpenChoreoEntityLayout>
      <DeleteConfirmationDialog />
      <AnnotationEditorDialog />
    </>
  );
}
