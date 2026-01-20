import { Entity } from '@backstage/catalog-model';
import { useMemo } from 'react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

export interface UseGetNamespaceAndProjectByEntityResult {
  namespace: string | undefined;
  project: string | undefined;
  error: string | null;
}

/**
 * Hook to extract the namespace and project name from an entity's annotations.
 *
 * @param entity - The Backstage entity to extract the namespace and project from
 * @returns Object containing namespace name, project name, and error
 */
export const useGetNamespaceAndProjectByEntity = (
  entity: Entity,
): UseGetNamespaceAndProjectByEntityResult => {
  const result = useMemo(() => {
    try {
      const namespace =
        entity?.metadata?.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];
      const project =
        entity?.metadata?.annotations?.[CHOREO_ANNOTATIONS.PROJECT];

      if (!namespace) {
        return {
          namespace: undefined,
          project: undefined,
          error: `Namespace annotation '${CHOREO_ANNOTATIONS.NAMESPACE}' not found in entity`,
        };
      }

      if (!project) {
        return {
          namespace,
          project: undefined,
          error: `Project annotation '${CHOREO_ANNOTATIONS.PROJECT}' not found in entity`,
        };
      }

      return {
        namespace,
        project,
        error: null,
      };
    } catch (err) {
      return {
        namespace: undefined,
        project: undefined,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }, [entity]);

  return result;
};
