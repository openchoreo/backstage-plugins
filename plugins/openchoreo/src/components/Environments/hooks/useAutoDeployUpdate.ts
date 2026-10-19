import { Entity } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import {
  useOpenChoreoMutation,
  useReleaseLine,
} from '@openchoreo/backstage-plugin-react';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { pickOverridableProperties } from '../../ReleaseLines/releaseLineUtils';

/**
 * Hook for updating the auto deploy setting: the component's, or on a release
 * line page, the line's autoDeploy override (keeping its other overrides).
 */
export const useAutoDeployUpdate = (entity: Entity) => {
  const client = useApi(openChoreoClientApiRef);
  const { releaseLine } = useReleaseLine();

  const { mutate, isLoading, error } = useOpenChoreoMutation(
    async (autoDeploy: boolean) => {
      if (!releaseLine) {
        await client.patchComponent(entity, autoDeploy);
        return;
      }
      const line = await client.fetchReleaseLine(entity, releaseLine);
      await client.updateReleaseLine(entity, releaseLine, {
        ...pickOverridableProperties(
          line.spec as Record<string, unknown> | undefined,
        ),
        autoDeploy,
      });
    },
  );

  return {
    updateAutoDeploy: async (autoDeploy: boolean): Promise<void> => {
      await mutate(autoDeploy);
    },
    isUpdating: isLoading,
    error: error
      ? error.message || 'Failed to update auto deploy setting'
      : null,
  };
};
