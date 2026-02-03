import { type ReactNode } from 'react';
import { Box } from '@material-ui/core';
import { EntityLayout } from '@backstage/plugin-catalog';
import { useEntity } from '@backstage/plugin-catalog-react';
import { EmptyState, Progress } from '@backstage/core-components';
import {
  useDeleteEntityMenuItems,
  useEntityExistsCheck,
  useAnnotationEditorMenuItems,
} from '@openchoreo/backstage-plugin';

/**
 * Gets the display label for an entity kind.
 * Maps Backstage entity kinds to OpenChoreo terminology.
 */
function getEntityTypeLabel(kind: string): string {
  // System in Backstage = Project in OpenChoreo
  if (kind.toLowerCase() === 'system') {
    return 'Project';
  }
  return kind;
}

/**
 * Wrapper component that adds delete menu functionality to EntityLayout.
 * Children (EntityLayout.Route elements) are passed through, keeping them
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
      <EntityLayout
        UNSTABLE_contextMenuOptions={{ disableUnregister: 'hidden' }}
      >
        <EntityLayout.Route path="/" title="Overview">
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
        </EntityLayout.Route>
      </EntityLayout>
    );
  }

  // Show empty state with header if entity is marked for deletion
  if (status === 'marked-for-deletion') {
    return (
      <EntityLayout
        UNSTABLE_contextMenuOptions={{ disableUnregister: 'hidden' }}
      >
        <EntityLayout.Route path="/" title="Overview">
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
        </EntityLayout.Route>
      </EntityLayout>
    );
  }

  return (
    <>
      <EntityLayout
        UNSTABLE_contextMenuOptions={{ disableUnregister: 'hidden' }}
        UNSTABLE_extraContextMenuItems={extraMenuItems}
      >
        {children}
      </EntityLayout>
      <DeleteConfirmationDialog />
      <AnnotationEditorDialog />
    </>
  );
}
