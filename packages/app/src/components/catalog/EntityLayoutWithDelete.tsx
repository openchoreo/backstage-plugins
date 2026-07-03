import { type ReactNode } from 'react';
import { Box } from '@material-ui/core';
import { useAsyncEntity, useEntity } from '@backstage/plugin-catalog-react';
import { EmptyState, Progress } from '@backstage/core-components';
import { VisuallyHidden } from '@openchoreo/backstage-design-system';
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
  'resourcetype',
  'projecttype',
  'clustercomponenttype',
  'clusterresourcetype',
  'clusterprojecttype',
  'traittype',
  'clustertraittype',
  'workflow',
  'clusterworkflow',
  'componentworkflow',
  'observabilityalertsnotificationchannel',
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
 * Inner content component that does the actual rendering once the entity is
 * known to be loaded. Called by the gating `EntityLayoutWithDelete` wrapper
 * below — must NEVER be rendered when `useAsyncEntity()` is still loading,
 * because `useEntity()` throws on undefined entity and the four custom hooks
 * (`useResourceDefinitionPermission`, `useDeleteEntityMenuItems`,
 * `useAnnotationEditorMenuItems`, `useEntityExistsCheck`) all access
 * `entity.kind` / `entity.metadata` unconditionally.
 */
function EntityLayoutWithDeleteContent({
  children,
  kindDisplayNames,
  parentEntityRelations = ['partOf'],
  contextMenuOptions = { disableUnregister: 'hidden' },
}: EntityLayoutWithDeleteProps) {
  const { entity } = useEntity();
  const entityTitle =
    (entity.metadata.title as string | undefined) ?? entity.metadata.name;

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
      <>
        <VisuallyHidden as="h1">{entityTitle}</VisuallyHidden>
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
      </>
    );
  }

  // Show empty state with header if entity is marked for deletion
  if (status === 'marked-for-deletion') {
    return (
      <>
        <VisuallyHidden as="h1">{entityTitle}</VisuallyHidden>
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
      </>
    );
  }

  return (
    <>
      <VisuallyHidden as="h1">{entityTitle}</VisuallyHidden>
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

/**
 * Gating wrapper. Lives directly under `AsyncEntityProvider` (see
 * `OpenChoreoCatalogEntityPage`) and handles the loading / error / missing
 * states upstream `EntityLayout` would normally handle. Once the entity is
 * loaded, defers to `EntityLayoutWithDeleteContent` for the real rendering.
 *
 * Necessary because `EntityLayoutWithDeleteContent` calls `useEntity()` and
 * several entity-dependent hooks unconditionally — calling them during the
 * loading window throws (`useEntity` rejects undefined entity).
 */
export function EntityLayoutWithDelete(props: EntityLayoutWithDeleteProps) {
  const { entity, loading, error } = useAsyncEntity();

  if (loading) {
    return <Progress />;
  }

  if (error) {
    return (
      <Box py={4}>
        <EmptyState
          missing="data"
          title="Failed to load entity"
          description={error.message}
        />
      </Box>
    );
  }

  if (!entity) {
    return (
      <Box py={4}>
        <EmptyState
          missing="data"
          title="Entity not found"
          description="The requested entity could not be found."
        />
      </Box>
    );
  }

  return <EntityLayoutWithDeleteContent {...props} />;
}
