import { useState } from 'react';
import { Entity } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';

/**
 * Hook for updating component auto deploy setting
 */
export const useAutoDeployUpdate = (entity: Entity) => {
  const client = useApi(openChoreoClientApiRef);

  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateAutoDeploy = async (autoDeploy: boolean): Promise<boolean> => {
    setIsUpdating(true);
    setError(null);

    try {
      await client.patchComponent(entity, autoDeploy);
      setIsUpdating(false);
      return true;
    } catch (err: any) {
      const errorMessage =
        err.message || 'Failed to update auto deploy setting';
      setError(errorMessage);
      setIsUpdating(false);
      return false;
    }
  };

  return {
    updateAutoDeploy,
    isUpdating,
    error,
  };
};
