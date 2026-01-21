import { useEffect, useState } from 'react';
import { Entity } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { EntityStatus, EntityExistsCheckResult } from '../types';

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
        let entityTypeLabel = entityKind; // Display label for the entity type

        if (entityKind === 'component') {
          details = await client.getComponentDetails(entity);
        } else if (entityKind === 'system') {
          // System in Backstage = Project in OpenChoreo
          details = await client.getProjectDetails(entity);
          entityTypeLabel = 'project';
        } else {
          // For other entity types, assume they exist
          setStatus('exists');
          return;
        }

        // Check if entity is marked for deletion
        if (details?.deletionTimestamp) {
          setStatus('marked-for-deletion');
          const formattedDate = new Date(
            details.deletionTimestamp,
          ).toLocaleString();
          setMessage(
            `This ${entityTypeLabel} "${entityName}" is marked for deletion (since ${formattedDate}). It will be permanently removed soon.`,
          );
          return;
        }

        setStatus('exists');
      } catch (error: unknown) {
        // Determine the display label for the entity type
        const entityTypeLabel =
          entityKind === 'system' ? 'project' : entityKind;

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
