import { useState } from 'react';
import { Entity } from '@backstage/catalog-model';
import { DiscoveryApi, IdentityApi } from '@backstage/core-plugin-api';
import { patchComponent } from '../../../api/environments';

/**
 * Hook for updating component auto deploy setting
 */
export const useAutoDeployUpdate = (
  entity: Entity,
  discovery: DiscoveryApi,
  identity: IdentityApi,
) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateAutoDeploy = async (autoDeploy: boolean): Promise<boolean> => {
    setIsUpdating(true);
    setError(null);

    try {
      await patchComponent(entity, discovery, identity, autoDeploy);
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
