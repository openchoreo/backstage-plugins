import { Entity } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { useOpenChoreoMutation } from '@openchoreo/backstage-plugin-react';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';

/**
 * Hook for updating component auto deploy setting
 */
export const useAutoDeployUpdate = (entity: Entity) => {
  const client = useApi(openChoreoClientApiRef);

  const { mutate, isLoading, error } = useOpenChoreoMutation(
    (autoDeploy: boolean) => client.patchComponent(entity, autoDeploy),
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
