import { Entity } from '@backstage/catalog-model';
import { DiscoveryApi, IdentityApi } from '@backstage/core-plugin-api';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

const API_ENDPOINTS = {
  WORKFLOW_SCHEMA: '/workflow-schema',
  COMPONENT_WORKFLOW_SCHEMA: '/component-workflow-schema',
} as const;

export async function fetchWorkflowSchema(
  discovery: DiscoveryApi,
  identity: IdentityApi,
  organizationName: string,
  workflowName: string,
) {
  const { token } = await identity.getCredentials();
  const backendUrl = new URL(
    `${await discovery.getBaseUrl('openchoreo')}${API_ENDPOINTS.WORKFLOW_SCHEMA}`,
  );

  const params = new URLSearchParams({
    organizationName,
    workflowName,
  });

  backendUrl.search = params.toString();

  const res = await fetch(backendUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to fetch workflow schema: ${errText}`);
  }

  return await res.json();
}

export async function updateComponentWorkflowSchema(
  entity: Entity,
  discovery: DiscoveryApi,
  identity: IdentityApi,
  schema: { [key: string]: unknown },
) {
  const { token } = await identity.getCredentials();
  const component = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];
  const project = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT];
  const organization =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ORGANIZATION];

  if (!project || !component || !organization) {
    throw new Error('Missing required metadata in entity');
  }

  const backendUrl = new URL(
    `${await discovery.getBaseUrl('openchoreo')}${API_ENDPOINTS.COMPONENT_WORKFLOW_SCHEMA}`,
  );

  const params = new URLSearchParams({
    componentName: component,
    projectName: project,
    organizationName: organization,
  });

  backendUrl.search = params.toString();

  const res = await fetch(backendUrl, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ schema }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to update workflow schema: ${errText}`);
  }

  return await res.json();
}
