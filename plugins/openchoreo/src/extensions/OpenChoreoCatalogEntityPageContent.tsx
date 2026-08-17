import { useEffect, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import useAsyncRetry from 'react-use/esm/useAsyncRetry';
import type { Entity } from '@backstage/catalog-model';
import { Box } from '@material-ui/core';
import { EmptyState, Progress } from '@backstage/core-components';
import {
  errorApiRef,
  useApi,
  useRouteRefParams,
} from '@backstage/core-plugin-api';
import {
  AsyncEntityProvider,
  catalogApiRef,
  entityRouteRef,
  useAsyncEntity,
  useEntity,
  type EntityLoadingStatus,
} from '@backstage/plugin-catalog-react';
import { VisuallyHidden } from '@openchoreo/backstage-design-system';
import {
  OpenChoreoEntityLayout,
  useResourceDefinitionPermission,
} from '@openchoreo/backstage-plugin-react';
import {
  useDeleteEntityMenuItems,
  useEntityExistsCheck,
  type DeletePermissionInfo,
} from '../components/DeleteEntity';
import { useAnnotationEditorMenuItems } from '../components/AnnotationEditor';

const KIND_DISPLAY_NAMES: Record<string, string> = {
  system: 'Project',
  domain: 'Namespace',
  buildplane: 'Build Plane',
  clusterbuildplane: 'Cluster Build Plane',
  dataplane: 'Data Plane',
  clusterdataplane: 'Cluster Data Plane',
  workflowplane: 'Workflow Plane',
  clusterworkflowplane: 'Cluster Workflow Plane',
  observabilityplane: 'Observability Plane',
  clusterobservabilityplane: 'Cluster Observability Plane',
  deploymentpipeline: 'Deployment Pipeline',
  componenttype: 'Component Type',
  resourcetype: 'Resource Type',
  projecttype: 'Project Type',
  clustercomponenttype: 'Cluster Component Type',
  clusterresourcetype: 'Cluster Resource Type',
  clusterprojecttype: 'Cluster Project Type',
  traittype: 'Trait Type',
  clustertraittype: 'Cluster Trait Type',
  workflow: 'Workflow',
  clusterworkflow: 'Cluster Workflow',
  componentworkflow: 'Component Workflow',
};

/**
 * Kinds that support upfront delete-permission checking. Non-platform kinds
 * (component / system / domain) skip the upfront check and surface a 403 in
 * the confirmation dialog instead.
 */
const PLATFORM_RESOURCE_KINDS = new Set([
  'domain',
  'environment',
  'dataplane',
  'clusterdataplane',
  'buildplane',
  'clusterbuildplane',
  'workflowplane',
  'clusterworkflowplane',
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
]);

/**
 * Local copy of upstream's internal `useEntityFromUrl` hook (not on
 * `@backstage/plugin-catalog`'s public surface — see
 * `node_modules/@backstage/plugin-catalog/src/components/CatalogEntityPage/useEntityFromUrl.ts`).
 * Inlined so the NFS `page:catalog/entity` override can mount its own
 * `AsyncEntityProvider` without relying on a private import.
 */
function useEntityFromUrl(): EntityLoadingStatus {
  const { kind, namespace, name } = useRouteRefParams(entityRouteRef);
  const navigate = useNavigate();
  const errorApi = useApi(errorApiRef);
  const catalogApi = useApi(catalogApiRef);

  const {
    value: entity,
    error,
    loading,
    retry: refresh,
  } = useAsyncRetry(
    () =>
      catalogApi.getEntityByRef({ kind, namespace, name }) as Promise<
        Entity | undefined
      >,
    [catalogApi, kind, namespace, name],
  );

  useEffect(() => {
    if (!name) {
      errorApi.post(new Error('No name provided!'));
      navigate('/');
    }
  }, [errorApi, navigate, error, loading, entity, name]);

  return { entity, loading, error, refresh };
}

export interface OpenChoreoRoute {
  /**
   * Stable identifier for React keying. Sourced from the contributing
   * extension's canonical id (e.g. `entity-content:openchoreo/component-deploy`)
   * so state stays with the correct tab across re-orders or hot reloads,
   * and two contributions sharing a path don't collide.
   */
  id: string;
  path: string;
  title: string;
  element: ReactElement;
  if?: (entity: Entity) => boolean;
}

export interface OpenChoreoCatalogEntityPageContentProps {
  routes: OpenChoreoRoute[];
}

/**
 * Inner render component: called once `useEntity()` has an entity. Owns
 * the OC context-menu extras (delete + annotation editor) and the
 * existence-check gate that shows an empty state for entities missing
 * from OpenChoreo or marked for deletion.
 */
function EntityChrome({ routes }: OpenChoreoCatalogEntityPageContentProps) {
  const { entity } = useEntity();
  const entityTitle =
    (entity.metadata.title as string | undefined) ?? entity.metadata.name;

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
  const {
    loading: existsLoading,
    status,
    message,
  } = useEntityExistsCheck(entity);

  const extraMenuItems = [...annotationMenuItems, ...deleteMenuItems];
  const entityTypeLabel =
    KIND_DISPLAY_NAMES[entity.kind.toLowerCase()] ?? entity.kind;

  if (existsLoading) return <Progress />;

  if (status === 'not-found' || status === 'marked-for-deletion') {
    const isMarked = status === 'marked-for-deletion';
    return (
      <>
        <VisuallyHidden as="h1">{entityTitle}</VisuallyHidden>
        <OpenChoreoEntityLayout
          contextMenuOptions={{ disableUnregister: 'hidden' }}
          parentEntityRelations={['partOf']}
          kindDisplayNames={KIND_DISPLAY_NAMES}
        >
          <OpenChoreoEntityLayout.Route path="/" title="Overview">
            <Box py={4}>
              <EmptyState
                missing="data"
                title={
                  isMarked
                    ? `${entityTypeLabel} Marked for Deletion`
                    : `${entityTypeLabel} Not Found`
                }
                description={
                  message ||
                  (isMarked
                    ? `This ${entityTypeLabel.toLowerCase()} "${
                        entity.metadata.name
                      }" is marked for deletion and will be permanently removed soon.`
                    : `The ${entityTypeLabel.toLowerCase()} "${
                        entity.metadata.name
                      }" could not be found in OpenChoreo. It may have been deleted.`)
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
        contextMenuOptions={{ disableUnregister: 'hidden' }}
        extraContextMenuItems={extraMenuItems}
        parentEntityRelations={['partOf']}
        kindDisplayNames={KIND_DISPLAY_NAMES}
      >
        {routes.map(r => (
          <OpenChoreoEntityLayout.Route
            key={r.id}
            path={r.path}
            title={r.title}
            if={r.if}
          >
            {r.element}
          </OpenChoreoEntityLayout.Route>
        ))}
      </OpenChoreoEntityLayout>
      <DeleteConfirmationDialog />
      <AnnotationEditorDialog />
    </>
  );
}

/**
 * Gate that waits for `useAsyncEntity()` to resolve before rendering
 * `EntityChrome` (which calls `useEntity()` unconditionally). Renders
 * the loading / error / entity-missing states directly.
 */
function ChromeGate(props: OpenChoreoCatalogEntityPageContentProps) {
  const { entity, loading, error } = useAsyncEntity();

  if (loading) return <Progress />;
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
  return <EntityChrome {...props} />;
}

/**
 * Root of the OpenChoreo `page:catalog/entity` override.
 *
 * Wires up:
 * - `AsyncEntityProvider` fed by the URL-derived entity ref (replaces the
 *   default `<CatalogEntityPage>` internal provider).
 * - `ChromeGate` + `EntityChrome` — resolve the entity, then render
 *   `OpenChoreoEntityLayout` with the plugin-contributed routes and the
 *   OC delete / annotation context-menu extras.
 *
 * Consumed by the `openChoreoEntityPageOverride` FrontendModule exported
 * from `plugins/openchoreo/src/alpha.tsx`.
 */
export function OpenChoreoCatalogEntityPageContent(
  props: OpenChoreoCatalogEntityPageContentProps,
) {
  return (
    <AsyncEntityProvider {...useEntityFromUrl()}>
      <ChromeGate {...props} />
    </AsyncEntityProvider>
  );
}
