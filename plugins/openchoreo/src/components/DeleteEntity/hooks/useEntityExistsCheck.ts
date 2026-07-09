import { Entity, stringifyEntityRef } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import {
  isSupportedKind,
  mapKindToApiKind,
} from '../../ResourceDefinition/utils';
import { EntityStatus, EntityExistsCheckResult } from '../types';
import { getDeletionTimestamp } from '../utils';

/** Human-friendly display names for entity kinds */
const KIND_DISPLAY_NAMES: Record<string, string> = {
  component: 'Component',
  resource: 'Resource',
  system: 'Project',
  environment: 'Environment',
  dataplane: 'Dataplane',
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
 * Hook to check if an entity exists in OpenChoreo and its deletion status.
 * Returns status to determine if entity page should show empty state.
 */
export function useEntityExistsCheck(entity: Entity): EntityExistsCheckResult {
  const client = useApi(openChoreoClientApiRef);

  const entityKind = entity.kind.toLowerCase();
  const entityName = entity.metadata.name;

  const { data, loading, isRefetching } = useOpenChoreoQuery(
    ['entity-exists-check', stringifyEntityRef(entity)],
    async (): Promise<{ status: EntityStatus; message: string | null }> => {
      try {
        let details: { uid?: string; deletionTimestamp?: string } | null = null;
        const entityTypeLabel = KIND_DISPLAY_NAMES[entityKind] ?? entityKind;

        if (entityKind === 'component') {
          details = await client.getComponentDetails(entity);
        } else if (entityKind === 'system') {
          // System in Backstage = Project in OpenChoreo
          details = await client.getProjectDetails(entity);
        } else if (isSupportedKind(entityKind)) {
          const apiKind = mapKindToApiKind(entityKind);
          const namespace =
            entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] ?? '';
          const resourceDef = await client.getResourceDefinition(
            apiKind,
            namespace,
            entityName,
          );
          const metadata = resourceDef?.metadata as
            | Record<string, unknown>
            | undefined;
          details = {
            deletionTimestamp: metadata?.deletionTimestamp as
              | string
              | undefined,
          };
        } else {
          // For unsupported entity types (domain, api, user, group, etc.), assume exists
          return { status: 'exists', message: null };
        }

        // Check if entity is marked for deletion (API response or catalog annotation)
        const deletionTs =
          details?.deletionTimestamp || getDeletionTimestamp(entity);
        if (deletionTs) {
          const formattedDate = new Date(deletionTs).toLocaleString();
          return {
            status: 'marked-for-deletion',
            message: `This ${entityTypeLabel} "${entityName}" is marked for deletion (since ${formattedDate}). It will be permanently removed soon.`,
          };
        }

        return { status: 'exists', message: null };
      } catch (error: unknown) {
        const entityTypeLabel = KIND_DISPLAY_NAMES[entityKind] ?? entityKind;

        // Check if it's a 404 error
        const is404 =
          error instanceof Error &&
          (error.message.includes('404') ||
            error.message.includes('not found') ||
            error.message.includes('Not Found'));

        if (is404) {
          return {
            status: 'not-found',
            message: `The ${entityTypeLabel} "${entityName}" could not be found in OpenChoreo. It may have been deleted.`,
          };
        }

        // For other errors, assume entity exists (don't block the page)
        return { status: 'exists', message: null };
      }
    },
  );

  return {
    loading,
    isRefetching,
    status: data?.status ?? null,
    message: data?.message ?? null,
  };
}
