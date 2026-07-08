import { type ReactNode } from 'react';
import { Typography } from '@material-ui/core';
import { Entity } from '@backstage/catalog-model';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import {
  OpenChoreoClientApi,
  CLUSTER_SCOPED_RESOURCE_KINDS,
} from '../../../api/OpenChoreoClientApi';
import {
  isSupportedKind,
  mapKindToApiKind,
} from '../../ResourceDefinition/utils';

/** Human-friendly display names for all deletable entity kinds */
const KIND_DISPLAY_NAMES: Record<string, string> = {
  component: 'Component',
  resource: 'Resource',
  system: 'Project',
  domain: 'Namespace',
  environment: 'Environment',
  observabilityalertsnotificationchannel: 'Notification Channel',
  dataplane: 'Dataplane',
  clusterdataplane: 'Cluster Data Plane',
  buildplane: 'Build Plane',
  clusterbuildplane: 'Cluster Build Plane',
  workflowplane: 'Workflow Plane',
  clusterworkflowplane: 'Cluster Workflow Plane',
  observabilityplane: 'Observability Plane',
  clusterobservabilityplane: 'Cluster Observability Plane',
  deploymentpipeline: 'Deployment Pipeline',
  componenttype: 'Component Type',
  resourcetype: 'Resource Type',
  clustercomponenttype: 'Cluster Component Type',
  clusterresourcetype: 'Cluster Resource Type',
  traittype: 'Trait Type',
  clustertraittype: 'Cluster Trait Type',
  workflow: 'Workflow',
  clusterworkflow: 'Cluster Workflow',
  componentworkflow: 'Component Workflow',
};

/** Display label for an entity kind, e.g. "system" -> "Project". */
export function getEntityDisplayType(kind: string): string {
  return KIND_DISPLAY_NAMES[kind.toLowerCase()] ?? kind;
}

/**
 * Whether the client can delete entities of this kind at all (the OC API has
 * a delete path for it). Kinds like `api`, `user`, `group`, `template` and
 * `location` are catalog-only projections and are not deletable.
 */
export function isDeletableEntityKind(kind: string): boolean {
  const kindLower = kind.toLowerCase();
  return (
    kindLower === 'component' ||
    kindLower === 'system' ||
    kindLower === 'domain' ||
    isSupportedKind(kindLower)
  );
}

/**
 * Dispatches an entity delete to the right OpenChoreo client call for its
 * kind. Single source of truth shared by the entity-page context menu
 * ({@link useDeleteEntityMenuItems}) and the listing row action
 * ({@link useDeleteEntityDialog}).
 */
export async function performEntityDelete(
  client: OpenChoreoClientApi,
  entity: Entity,
): Promise<void> {
  const entityKind = entity.kind.toLowerCase();
  const entityName = entity.metadata.name;

  if (entityKind === 'component') {
    await client.deleteComponent(entity);
    return;
  }
  if (entityKind === 'system') {
    await client.deleteProject(entity);
    return;
  }
  if (entityKind === 'domain') {
    await client.deleteNamespace(entity);
    return;
  }
  if (isSupportedKind(entityKind)) {
    const apiKind = mapKindToApiKind(entityKind);
    const namespace =
      entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];

    if (!CLUSTER_SCOPED_RESOURCE_KINDS.has(apiKind) && !namespace) {
      throw new Error(
        `Missing namespace annotation for ${getEntityDisplayType(
          entityKind,
        ).toLowerCase()} "${entityName}"`,
      );
    }

    await client.deleteResourceDefinition(apiKind, namespace ?? '', entityName);
    return;
  }
  throw new Error(`Unsupported entity kind for deletion: ${entity.kind}`);
}

/**
 * Extra warning line for deletes that cascade to child entities, shown inside
 * the confirmation dialog. Undefined for kinds without a cascade.
 */
export function getEntityDeleteCascadeNote(kind: string): ReactNode {
  const kindLower = kind.toLowerCase();
  if (kindLower === 'system') {
    return (
      <Typography variant="h5">
        Note: All components within this project will also be deleted.
      </Typography>
    );
  }
  if (kindLower === 'domain') {
    return (
      <Typography variant="h5">
        Note: All projects and components within this namespace will also be
        deleted.
      </Typography>
    );
  }
  return undefined;
}
