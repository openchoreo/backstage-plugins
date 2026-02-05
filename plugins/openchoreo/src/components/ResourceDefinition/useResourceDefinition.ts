import { useState, useEffect, useCallback } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { Entity } from '@backstage/catalog-model';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../api/OpenChoreoClientApi';
import { mapKindToApiKind, cleanCrdForEditing, isSupportedKind } from './utils';

export interface UseResourceDefinitionOptions {
  entity: Entity;
}

export interface UseResourceDefinitionResult {
  /** The full CRD as JSON (cleaned for editing) */
  definition: Record<string, unknown> | null;
  /** Whether the definition is loading */
  isLoading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Refresh the definition from the API */
  refresh: () => Promise<void>;
  /** Save the updated definition */
  save: (resource: Record<string, unknown>) => Promise<void>;
  /** Delete the resource */
  deleteResource: () => Promise<void>;
  /** Whether a save operation is in progress */
  isSaving: boolean;
  /** Whether the entity kind is supported */
  isSupported: boolean;
}

/**
 * Hook for fetching and managing a platform resource definition
 */
export function useResourceDefinition({
  entity,
}: UseResourceDefinitionOptions): UseResourceDefinitionResult {
  const client = useApi(openChoreoClientApiRef);

  const [definition, setDefinition] = useState<Record<string, unknown> | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kind = entity.kind;
  const namespace = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];
  const resourceName = entity.metadata.name;
  const isSupported = isSupportedKind(kind);

  const fetchDefinition = useCallback(async () => {
    if (!isSupported || !namespace || !resourceName) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const apiKind = mapKindToApiKind(kind);
      const data = await client.getResourceDefinition(
        apiKind,
        namespace,
        resourceName,
      );
      const cleaned = cleanCrdForEditing(data);
      setDefinition(cleaned);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to fetch resource definition';
      setError(message);
      setDefinition(null);
    } finally {
      setIsLoading(false);
    }
  }, [client, kind, namespace, resourceName, isSupported]);

  // Fetch on mount and when entity changes
  useEffect(() => {
    fetchDefinition();
  }, [fetchDefinition]);

  const save = useCallback(
    async (resource: Record<string, unknown>) => {
      if (!isSupported || !namespace || !resourceName) {
        throw new Error(
          'Cannot save: entity not supported or missing required fields',
        );
      }

      setIsSaving(true);
      setError(null);

      try {
        const apiKind = mapKindToApiKind(kind);
        await client.updateResourceDefinition(
          apiKind,
          namespace,
          resourceName,
          resource,
        );
        // Refresh to get the latest version from the server
        await fetchDefinition();
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to save resource definition';
        setError(message);
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [client, kind, namespace, resourceName, isSupported, fetchDefinition],
  );

  const deleteResource = useCallback(async () => {
    if (!isSupported || !namespace || !resourceName) {
      throw new Error(
        'Cannot delete: entity not supported or missing required fields',
      );
    }

    try {
      const apiKind = mapKindToApiKind(kind);
      await client.deleteResourceDefinition(apiKind, namespace, resourceName);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to delete resource';
      setError(message);
      throw err;
    }
  }, [client, kind, namespace, resourceName, isSupported]);

  return {
    definition,
    isLoading,
    error,
    refresh: fetchDefinition,
    save,
    deleteResource,
    isSaving,
    isSupported,
  };
}
