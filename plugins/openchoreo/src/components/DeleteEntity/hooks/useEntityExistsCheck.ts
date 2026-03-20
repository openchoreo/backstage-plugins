import { useEffect, useState } from 'react';
import { Entity } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
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
  clustercomponenttype: 'Cluster Component Type',
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
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<EntityStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const entityKind = entity.kind.toLowerCase();
  const entityName = entity.metadata.name;

  useEffect(() => {
    const checkEntityStatus = async () => {
      setLoading(true);
      setMessage(null);

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
          setStatus('exists');
          return;
        }

        // Check if entity is marked for deletion (API response or catalog annotation)
        const deletionTs =
          details?.deletionTimestamp || getDeletionTimestamp(entity);
        if (deletionTs) {
          setStatus('marked-for-deletion');
          const formattedDate = new Date(deletionTs).toLocaleString();
          setMessage(
            `This ${entityTypeLabel} "${entityName}" is marked for deletion (since ${formattedDate}). It will be permanently removed soon.`,
          );
          return;
        }

        setStatus('exists');
      } catch (error: unknown) {
        const entityTypeLabel = KIND_DISPLAY_NAMES[entityKind] ?? entityKind;

        // Check if it's a 404 error
        const is404 =
          error instanceof Error &&
          (error.message.includes('404') ||
            error.message.includes('not found') ||
            error.message.includes('Not Found'));

        if (is404) {
          setStatus('not-found');
          setMessage(
            `The ${entityTypeLabel} "${entityName}" could not be found in OpenChoreo. It may have been deleted.`,
          );
        } else {
          // For other errors, assume entity exists (don't block the page)
          setStatus('exists');
        }
      } finally {
        setLoading(false);
      }
    };

    checkEntityStatus();
  }, [entity, client, entityKind, entityName]);

  return { loading, status, message };
}
