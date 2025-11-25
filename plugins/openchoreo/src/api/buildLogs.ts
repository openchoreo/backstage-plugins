import { DiscoveryApi, IdentityApi } from '@backstage/core-plugin-api';
import type {
  ModelsBuild,
  RuntimeLogsResponse,
} from '@openchoreo/backstage-plugin-common';
import { apiFetch } from './client';

export interface BuildLogsParams {
  componentName: string;
  projectName: string;
  orgName: string;
  buildId: string;
  buildUuid: string;
  limit?: number;
  sortOrder?: 'asc' | 'desc';
}

interface BuildLogsApiResponse {
  success?: boolean;
  data?: {
    message?: string;
  };
  logs?: RuntimeLogsResponse['logs'];
  totalCount?: number;
  tookMs?: number;
}

export async function getBuildLogs(
  discovery: DiscoveryApi,
  identity: IdentityApi,
  params: BuildLogsParams,
): Promise<RuntimeLogsResponse> {
  const data = await apiFetch<BuildLogsApiResponse>({
    endpoint: '/build-logs',
    discovery,
    identity,
    params: {
      componentName: params.componentName,
      buildId: params.buildId,
      buildUuid: params.buildUuid,
      limit: (params.limit || 100).toString(),
      sortOrder: params.sortOrder || 'desc',
      projectName: params.projectName,
      orgName: params.orgName,
    },
  });

  if (
    data.success &&
    data.data?.message === 'observability-logs have not been configured'
  ) {
    throw new Error(
      "Observability has not been configured so build logs aren't available",
    );
  }

  return data as RuntimeLogsResponse;
}

export async function fetchBuildLogsForBuild(
  discovery: DiscoveryApi,
  identity: IdentityApi,
  build: ModelsBuild,
): Promise<RuntimeLogsResponse> {
  if (
    !build.componentName ||
    !build.name ||
    !build.uuid ||
    !build.projectName ||
    !build.orgName
  ) {
    throw new Error(
      'Component name, Build ID, UUID, Project name, or Organization name not available',
    );
  }

  return getBuildLogs(discovery, identity, {
    componentName: build.componentName,
    buildId: build.name,
    buildUuid: build.uuid,
    projectName: build.projectName,
    orgName: build.orgName,
    limit: 100,
    sortOrder: 'desc',
  });
}
