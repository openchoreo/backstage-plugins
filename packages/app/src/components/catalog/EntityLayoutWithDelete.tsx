import { type ReactNode } from 'react';
import { Box } from '@material-ui/core';
import { useEntity } from '@backstage/plugin-catalog-react';
import { EmptyState, Progress } from '@backstage/core-components';
import {
  useDeleteEntityMenuItems,
  useEntityExistsCheck,
  useAnnotationEditorMenuItems,
  type DeletePermissionInfo,
} from '@openchoreo/backstage-plugin';
import {
  OpenChoreoEntityLayout,
  useResourceDefinitionPermission,
} from '@openchoreo/backstage-plugin-react';

const KIND_DISPLAY_NAMES: Record<string, string> = {
  system: 'Project',
  domain: 'Namespace',
};

/** Platform resource kinds that support upfront permission checking for delete */
const PLATFORM_RESOURCE_KINDS = new Set([
  'domain',
  'environment',
  'dataplane',
  'clusterdataplane',
  'buildplane',
  'clusterbuildplane',
  'observabilityplane',
  'clusterobservabilityplane',
  'deploymentpipeline',
  'componenttype',
  'clustercomponenttype',
  'traittype',
  'clustertraittype',
  'workflow',
  'clusterworkflow',
  'componentworkflow',
]);

/**
 * Gets the display label for an entity kind.
 * Maps Backstage entity kinds to OpenChoreo terminology.
 */
function getEntityTypeLabel(kind: string): string {
  return KIND_DISPLAY_NAMES[kind.toLowerCase()] ?? kind;
}

interface EntityLayoutWithDeleteProps {
  children: ReactNode;
  kindDisplayNames?: Record<string, string>;
  parentEntityRelations?: string[];
  contextMenuOptions?: {
    disableUnregister: boolean | 'visible' | 'hidden' | 'disable';
  };
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
export function EntityLayoutWithDelete({
  children,
  kindDisplayNames,
  parentEntityRelations = ['partOf'],
  contextMenuOptions = { disableUnregister: 'hidden' },
}: EntityLayoutWithDeleteProps) {
  const { entity } = useEntity();

  // Permission check for platform resources
  const {
    canDelete: permCanDelete,
    loading: permLoading,
    deleteDeniedTooltip,
  } = useResourceDefinitionPermission();

  const isPlatformResource = PLATFORM_RESOURCE_KINDS.has(
    entity.kind.toLowerCase(),
  );

  const deletePermission: DeletePermissionInfo | undefined = isPlatformResource
    ? {
        canDelete: permCanDelete,
        loading: permLoading,
        deniedTooltip: deleteDeniedTooltip,
      }
    : undefined;

  const { extraMenuItems: deleteMenuItems, DeleteConfirmationDialog } =
    useDeleteEntityMenuItems(entity, deletePermission);
  const {
    extraMenuItems: annotationMenuItems,
    EditAnnotationsDialog: AnnotationEditorDialog,
  } = useAnnotationEditorMenuItems(entity);
  const { loading, status, message } = useEntityExistsCheck(entity);

  const extraMenuItems = [...annotationMenuItems, ...deleteMenuItems];

  // Merge kind display names: built-in defaults + caller overrides
  const mergedKindDisplayNames = {
    ...KIND_DISPLAY_NAMES,
    ...kindDisplayNames,
  };

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
        contextMenuOptions={contextMenuOptions}
        parentEntityRelations={parentEntityRelations}
        kindDisplayNames={mergedKindDisplayNames}
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
        contextMenuOptions={contextMenuOptions}
        parentEntityRelations={parentEntityRelations}
        kindDisplayNames={mergedKindDisplayNames}
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
        contextMenuOptions={contextMenuOptions}
        extraContextMenuItems={extraMenuItems}
        parentEntityRelations={parentEntityRelations}
        kindDisplayNames={mergedKindDisplayNames}
      >
        {children}
      </OpenChoreoEntityLayout>
      <DeleteConfirmationDialog />
      <AnnotationEditorDialog />
    </>
  );
}
