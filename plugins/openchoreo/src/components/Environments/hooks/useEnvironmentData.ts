import { Entity, stringifyEntityRef } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';
import type { ReleaseBindingCondition } from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { isForbiddenError } from '../../../utils/errorUtils';

export interface EndpointURLDetails {
  host: string;
  path?: string;
  port: number;
  scheme: string;
}

export interface EndpointInfo {
  name: string;
  type?: string;
  externalURLs?: Record<string, EndpointURLDetails>;
  internalURLs?: Record<string, EndpointURLDetails>;
  serviceURL?: EndpointURLDetails;
}

export interface Environment {
  uid?: string;
  name: string;
  resourceName?: string;
  bindingName?: string;
  /**
   * Whether the owning project is deployed in this environment (its cell
   * namespace exists), which a component requires before it can run here.
   * `ready` — deployed; `pending` — project binding exists but its namespace
   * isn't ready yet; `not-deployed` — no project binding for this env.
   * Absent → treat as deployed (backend fail-open).
   */
  projectDeploymentStatus?: 'ready' | 'pending' | 'not-deployed';
  hasComponentTypeOverrides?: boolean;
  dataPlaneRef?: string;
  dataPlaneKind?: 'DataPlane' | 'ClusterDataPlane';
  deployment: {
    status?: 'Ready' | 'NotReady' | 'Failed';
    statusReason?: string;
    statusMessage?: string;
    /** Raw Ready/other conditions from the ReleaseBinding, surfaced so the
     *  detail panel can show the controller's failure reason + message. */
    conditions?: ReleaseBindingCondition[];
    lastDeployed?: string;
    image?: string;
    releaseName?: string;
  };
  endpoints: EndpointInfo[];
  promotionTargets?: {
    name: string;
    resourceName?: string;
  }[];
}

export function useEnvironmentData(entity: Entity) {
  const client = useApi(openChoreoClientApiRef);

  const { data, loading, isRefetching, error, refetch } = useOpenChoreoQuery(
    ['environments', stringifyEntityRef(entity)],
    () => client.fetchEnvironmentInfo(entity) as Promise<Environment[]>,
  );

  return {
    environments: data ?? [],
    loading,
    // Background refresh with environments already on screen — lets the Deploy
    // tab keep content and show a subtle overlay instead of blanking.
    isRefetching,
    error,
    isForbidden: isForbiddenError(error),
    refetch,
  };
}
