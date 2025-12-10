import { Entity } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { useAsyncRetry } from 'react-use';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';

interface EndpointInfo {
  name: string;
  type: string;
  url: string;
  visibility: 'project' | 'organization' | 'public';
}

export interface Environment {
  uid?: string;
  name: string;
  resourceName?: string;
  bindingName?: string;
  hasComponentTypeOverrides?: boolean;
  deployment: {
    status?: 'Ready' | 'NotReady' | 'Failed';
    lastDeployed?: string;
    image?: string;
    releaseName?: string;
  };
  endpoints: EndpointInfo[];
  promotionTargets?: {
    name: string;
    requiresApproval?: boolean;
    isManualApprovalRequired?: boolean;
  }[];
}

export function useEnvironmentData(entity: Entity) {
  const client = useApi(openChoreoClientApiRef);

  const {
    loading,
    value: environments,
    error,
    retry,
  } = useAsyncRetry(async () => {
    const data = await client.fetchEnvironmentInfo(entity);
    return data as Environment[];
  }, [entity, client]);

  return {
    environments: environments ?? [],
    loading,
    error,
    refetch: retry,
  };
}
