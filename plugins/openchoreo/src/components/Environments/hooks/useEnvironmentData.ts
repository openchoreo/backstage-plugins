import { Entity } from '@backstage/catalog-model';
import {
  discoveryApiRef,
  identityApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import { useAsyncRetry } from 'react-use';
import { fetchEnvironmentInfo } from '../../../api/environments';

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
    status: 'success' | 'failed' | 'pending' | 'not-deployed' | 'suspended';
    lastDeployed?: string;
    image?: string;
    statusMessage?: string;
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
  const discovery = useApi(discoveryApiRef);
  const identityApi = useApi(identityApiRef);

  const {
    loading,
    value: environments,
    error,
    retry,
  } = useAsyncRetry(async () => {
    const data = await fetchEnvironmentInfo(entity, discovery, identityApi);
    return data as Environment[];
  }, [entity, discovery, identityApi]);

  return {
    environments: environments ?? [],
    loading,
    error,
    refetch: retry,
  };
}
