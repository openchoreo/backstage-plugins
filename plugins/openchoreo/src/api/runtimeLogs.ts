import { Entity } from '@backstage/catalog-model';
import { DiscoveryApi, IdentityApi } from '@backstage/core-plugin-api';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { API_ENDPOINTS } from '../constants/api';
import { apiFetch, apiFetchRaw } from './client';
import {
  extractEntityMetadata,
  tryExtractEntityMetadata,
  entityMetadataToParams,
} from '../utils/entityUtils';
import {
  LogsResponse,
  RuntimeLogsParams,
  Environment,
} from '../components/RuntimeLogs/types';

export async function getComponentDetails(
  entity: Entity,
  discovery: DiscoveryApi,
  identity: IdentityApi,
): Promise<{ uid?: string }> {
  const metadata = extractEntityMetadata(entity);

  return apiFetch({
    endpoint: '/component',
    discovery,
    identity,
    params: entityMetadataToParams(metadata),
  });
}

export async function getRuntimeLogs(
  entity: Entity,
  discovery: DiscoveryApi,
  identity: IdentityApi,
  params: RuntimeLogsParams,
): Promise<LogsResponse> {
  const project = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT];
  const organization =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ORGANIZATION];

  const queryParams: Record<string, string> = {};
  if (project && organization) {
    queryParams.orgName = organization;
    queryParams.projectName = project;
  }

  // Use apiFetchRaw because we need custom error handling
  const response = await apiFetchRaw({
    endpoint: `${API_ENDPOINTS.RUNTIME_LOGS}/${params.componentName}`,
    discovery,
    identity,
    method: 'POST',
    params: queryParams,
    body: {
      componentId: params.componentId,
      componentName: params.componentName,
      environmentId: params.environmentId,
      environmentName: params.environmentName,
      logLevels: params.logLevels,
      startTime: params.startTime,
      endTime: params.endTime,
      limit: params.limit,
      offset: params.offset,
    },
  });

  const data = await response.json();

  // Check if observability is disabled
  if (response.ok && data.message === 'observability is disabled') {
    throw new Error('Observability is not enabled for this component');
  }

  if (!response.ok) {
    throw new Error(
      `Failed to fetch runtime logs: ${response.status} ${response.statusText}`,
    );
  }

  return data;
}

export async function getEnvironments(
  entity: Entity,
  discovery: DiscoveryApi,
  identity: IdentityApi,
): Promise<Environment[]> {
  const metadata = tryExtractEntityMetadata(entity);
  if (!metadata) {
    return [];
  }

  const envData = await apiFetch<any[]>({
    endpoint: API_ENDPOINTS.ENVIRONMENT_INFO,
    discovery,
    identity,
    params: entityMetadataToParams(metadata),
  });

  // Transform the environment data to match our interface
  return envData.map((env: any) => ({
    id: env.uid || env.name,
    name: env.name || env.uid,
  }));
}

export function calculateTimeRange(timeRange: string): {
  startTime: string;
  endTime: string;
} {
  const now = new Date();
  const endTime = now.toISOString();

  const timeRangeMs: Record<string, number> = {
    '10m': 10 * 60 * 1000,
    '30m': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '14d': 14 * 24 * 60 * 60 * 1000,
  };

  const msAgo = timeRangeMs[timeRange] || timeRangeMs['1h'];
  const startTime = new Date(now.getTime() - msAgo);

  return {
    startTime: startTime.toISOString(),
    endTime,
  };
}
