import { useCallback } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { Entity } from '@backstage/catalog-model';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import {
  useOpenChoreoMutation,
  useOpenChoreoQuery,
} from '@openchoreo/backstage-plugin-react';
import {
  openChoreoClientApiRef,
  type PlatformResourceKind,
} from '../../api/OpenChoreoClientApi';
import {
  mapKindToApiKind,
  cleanCrdForEditing,
  isSupportedKind,
  isClusterScopedKind,
} from './utils';

export interface UseResourceDefinitionOptions {
  entity: Entity;
}

export interface UseResourceDefinitionResult {
  /** The full CRD as JSON (cleaned for editing) */
  definition: Record<string, unknown> | null;
  /** Whether the definition is loading */
  isLoading: boolean;
  /** A background refresh is in flight while data is already on screen. */
  isRefetching: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Raw error object for type checking (e.g., isForbiddenError) */
  rawError: Error | null;
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

  const kind = entity.kind;
  const clusterScoped = isClusterScopedKind(kind);
  const namespace = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];
  const resourceName = entity.metadata.name;
  const isSupported = isSupportedKind(kind);
  // `mapKindToApiKind` throws on an unsupported kind, so only resolve it when the
  // kind is supported. The query and mutations are gated on `canOperate`
  // (⊆ isSupported), so this placeholder is never used for a real request — it
  // only keeps the query key well-typed for the unsupported (idle) case.
  const apiKind: PlatformResourceKind = isSupported
    ? mapKindToApiKind(kind)
    : 'resources';

  const canOperate =
    isSupported && !!resourceName && (clusterScoped || !!namespace);
  const definitionKey = [
    'resource-definition',
    apiKind,
    namespace ?? '',
    resourceName,
  ];

  const { data, loading, isRefetching, error, refetch } = useOpenChoreoQuery<
    Record<string, unknown>
  >(
    definitionKey,
    async () => {
      const raw = await client.getResourceDefinition(
        apiKind,
        namespace || '',
        resourceName,
      );
      return cleanCrdForEditing(raw);
    },
    { enabled: canOperate },
  );

  const { mutate: runSave, isLoading: isSaving } = useOpenChoreoMutation(
    (resource: Record<string, unknown>) =>
      client.updateResourceDefinition(
        apiKind,
        namespace || '',
        resourceName,
        resource,
      ),
    { invalidates: [definitionKey] },
  );

  const { mutate: runDelete } = useOpenChoreoMutation(() =>
    client.deleteResourceDefinition(apiKind, namespace || '', resourceName),
  );

  const save = useCallback(
    async (resource: Record<string, unknown>) => {
      if (!canOperate) {
        throw new Error(
          'Cannot save: entity not supported or missing required fields',
        );
      }
      await runSave(resource);
    },
    [canOperate, runSave],
  );

  const deleteResource = useCallback(async () => {
    if (!canOperate) {
      throw new Error(
        'Cannot delete: entity not supported or missing required fields',
      );
    }
    await runDelete();
  }, [canOperate, runDelete]);

  return {
    definition: data ?? null,
    isLoading: loading,
    isRefetching,
    error: error ? error.message : null,
    rawError: error,
    refresh: async () => {
      await refetch();
    },
    save,
    deleteResource,
    isSaving,
    isSupported,
  };
}
