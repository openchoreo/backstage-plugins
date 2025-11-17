import { Entity } from '@backstage/catalog-model';
import { useMemo } from 'react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

export interface UseGetOrgAndProjectByEntityResult {
  organization: string | undefined;
  project: string | undefined;
  error: string | null;
}

/**
 * Hook to extract the organization and project name from an entity's annotations.
 *
 * @param entity - The Backstage entity to extract the organization and project from
 * @returns Object containing organization name, project name, and error
 */
export const useGetOrgAndProjectByEntity = (
  entity: Entity,
): UseGetOrgAndProjectByEntityResult => {
  const result = useMemo(() => {
    try {
      const organization =
        entity?.metadata?.annotations?.[CHOREO_ANNOTATIONS.ORGANIZATION];
      const project =
        entity?.metadata?.annotations?.[CHOREO_ANNOTATIONS.PROJECT];

      if (!organization) {
        return {
          organization: undefined,
          project: undefined,
          error: `Organization annotation '${CHOREO_ANNOTATIONS.ORGANIZATION}' not found in entity`,
        };
      }

      if (!project) {
        return {
          organization,
          project: undefined,
          error: `Project annotation '${CHOREO_ANNOTATIONS.PROJECT}' not found in entity`,
        };
      }

      return {
        organization,
        project,
        error: null,
      };
    } catch (err) {
      return {
        organization: undefined,
        project: undefined,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }, [entity]);

  return result;
};
