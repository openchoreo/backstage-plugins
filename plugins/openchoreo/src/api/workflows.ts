import { Entity } from '@backstage/catalog-model';
import { DiscoveryApi, IdentityApi } from '@backstage/core-plugin-api';
import { apiFetch } from './client';
import {
  extractEntityMetadata,
  entityMetadataToParams,
} from '../utils/entityUtils';

const API_ENDPOINTS = {
  WORKFLOW_SCHEMA: '/workflow-schema',
  COMPONENT_WORKFLOW_SCHEMA: '/component-workflow-schema',
} as const;

/** Workflow schema response */
export interface WorkflowSchemaResponse {
  success: boolean;
  data?: unknown;
}

export async function fetchWorkflowSchema(
  discovery: DiscoveryApi,
  identity: IdentityApi,
  organizationName: string,
  workflowName: string,
): Promise<WorkflowSchemaResponse> {
  return apiFetch<WorkflowSchemaResponse>({
    endpoint: API_ENDPOINTS.WORKFLOW_SCHEMA,
    discovery,
    identity,
    params: {
      organizationName,
      workflowName,
    },
  });
}

export async function updateComponentWorkflowSchema(
  entity: Entity,
  discovery: DiscoveryApi,
  identity: IdentityApi,
  systemParameters: { [key: string]: unknown } | null,
  parameters: { [key: string]: unknown } | null,
) {
  const metadata = extractEntityMetadata(entity);

  return apiFetch({
    endpoint: API_ENDPOINTS.COMPONENT_WORKFLOW_SCHEMA,
    discovery,
    identity,
    method: 'PATCH',
    params: entityMetadataToParams(metadata),
    body: { systemParameters, parameters },
  });
}
