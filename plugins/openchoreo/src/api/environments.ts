import { Entity } from '@backstage/catalog-model';
import { DiscoveryApi, IdentityApi } from '@backstage/core-plugin-api';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { API_ENDPOINTS } from '../constants';

export async function fetchEnvironmentInfo(
  entity: Entity,
  discovery: DiscoveryApi,
  identity: IdentityApi,
) {
  const { token } = await identity.getCredentials();
  const backendUrl = new URL(
    `${await discovery.getBaseUrl('openchoreo')}${
      API_ENDPOINTS.ENVIRONMENT_INFO
    }`,
  );
  const component = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];
  const project = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT];
  const organization =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ORGANIZATION];
  if (!project || !component || !organization) {
    // TODO: improve logging
    return [];
  }
  const params = new URLSearchParams({
    componentName: component,
    projectName: project,
    organizationName: organization,
  });

  backendUrl.search = params.toString();

  const res = await fetch(backendUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return await res.json();
}

export async function promoteToEnvironment(
  entity: Entity,
  discovery: DiscoveryApi,
  identity: IdentityApi,
  sourceEnvironment: string,
  targetEnvironment: string,
) {
  const { token } = await identity.getCredentials();
  const backendUrl = new URL(
    `${await discovery.getBaseUrl('openchoreo')}${
      API_ENDPOINTS.PROMOTE_DEPLOYMENT
    }`,
  );
  const component = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];
  const project = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT];
  const organization =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ORGANIZATION];

  if (!project || !component || !organization) {
    throw new Error('Missing required metadata in entity');
  }

  const promoteReq = {
    sourceEnv: sourceEnvironment,
    targetEnv: targetEnvironment,
    componentName: component,
    projectName: project,
    orgName: organization,
  };

  const res = await fetch(backendUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(promoteReq),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Promotion failed: ${errText}`);
  }

  return await res.json();
}

export async function deleteReleaseBinding(
  entity: Entity,
  discovery: DiscoveryApi,
  identity: IdentityApi,
  environment: string,
) {
  const { token } = await identity.getCredentials();
  const backendUrl = new URL(
    `${await discovery.getBaseUrl('openchoreo')}${
      API_ENDPOINTS.DELETE_RELEASE_BINDING
    }`,
  );
  const component = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];
  const project = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT];
  const organization =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ORGANIZATION];

  if (!project || !component || !organization) {
    throw new Error('Missing required metadata in entity');
  }

  const deleteReq = {
    orgName: organization,
    projectName: project,
    componentName: component,
    environment: environment,
  };

  const res = await fetch(backendUrl, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(deleteReq),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to delete release binding: ${errText}`);
  }

  return await res.json();
}

export async function updateComponentBinding(
  entity: Entity,
  discovery: DiscoveryApi,
  identity: IdentityApi,
  bindingName: string,
  releaseState: 'Active' | 'Suspend' | 'Undeploy',
) {
  const { token } = await identity.getCredentials();
  const backendUrl = new URL(
    `${await discovery.getBaseUrl('openchoreo')}${
      API_ENDPOINTS.UPDATE_BINDING
    }`,
  );
  const component = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];
  const project = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT];
  const organization =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ORGANIZATION];

  if (!project || !component || !organization) {
    throw new Error('Missing required metadata in entity');
  }

  const updateReq = {
    orgName: organization,
    projectName: project,
    componentName: component,
    bindingName: bindingName,
    releaseState: releaseState,
  };

  const res = await fetch(backendUrl, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(updateReq),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to update binding: ${errText}`);
  }

  return await res.json();
}

export async function createComponentRelease(
  entity: Entity,
  discovery: DiscoveryApi,
  identity: IdentityApi,
  releaseName?: string,
) {
  const { token } = await identity.getCredentials();
  const backendUrl = new URL(
    `${await discovery.getBaseUrl('openchoreo')}${
      API_ENDPOINTS.CREATE_RELEASE
    }`,
  );
  const component = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];
  const project = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT];
  const organization =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ORGANIZATION];

  if (!project || !component || !organization) {
    throw new Error('Missing required metadata in entity');
  }

  const params = new URLSearchParams({
    componentName: component,
    projectName: project,
    organizationName: organization,
  });

  backendUrl.search = params.toString();

  const res = await fetch(backendUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ releaseName }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to create release: ${errText}`);
  }

  return await res.json();
}

export async function deployRelease(
  entity: Entity,
  discovery: DiscoveryApi,
  identity: IdentityApi,
  releaseName: string,
) {
  const { token } = await identity.getCredentials();
  const backendUrl = new URL(
    `${await discovery.getBaseUrl('openchoreo')}${
      API_ENDPOINTS.DEPLOY_RELEASE
    }`,
  );
  const component = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];
  const project = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT];
  const organization =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ORGANIZATION];

  if (!project || !component || !organization) {
    throw new Error('Missing required metadata in entity');
  }

  const params = new URLSearchParams({
    componentName: component,
    projectName: project,
    organizationName: organization,
  });

  backendUrl.search = params.toString();

  const res = await fetch(backendUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ releaseName }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Deployment failed: ${errText}`);
  }

  return await res.json();
}

export async function fetchComponentReleaseSchema(
  entity: Entity,
  discovery: DiscoveryApi,
  identity: IdentityApi,
  releaseName: string,
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
    `${await discovery.getBaseUrl('openchoreo')}${
      API_ENDPOINTS.COMPONENT_RELEASE_SCHEMA
    }`,
  );

  const params = new URLSearchParams({
    componentName: component,
    projectName: project,
    organizationName: organization,
    releaseName: releaseName,
  });

  backendUrl.search = params.toString();

  const res = await fetch(backendUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to fetch schema: ${errText}`);
  }

  return await res.json();
}

export async function fetchReleaseBindings(
  entity: Entity,
  discovery: DiscoveryApi,
  identity: IdentityApi,
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
    `${await discovery.getBaseUrl('openchoreo')}${
      API_ENDPOINTS.RELEASE_BINDINGS
    }`,
  );

  const params = new URLSearchParams({
    componentName: component,
    projectName: project,
    organizationName: organization,
  });

  backendUrl.search = params.toString();

  const res = await fetch(backendUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to fetch bindings: ${errText}`);
  }

  return await res.json();
}

export async function patchReleaseBindingOverrides(
  entity: Entity,
  discovery: DiscoveryApi,
  identity: IdentityApi,
  environment: string,
  overrides: any,
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
    `${await discovery.getBaseUrl('openchoreo')}${
      API_ENDPOINTS.PATCH_RELEASE_BINDING
    }`,
  );

  const patchReq = {
    orgName: organization,
    projectName: project,
    componentName: component,
    environment: environment,
    componentTypeEnvOverrides: overrides,
  };

  const res = await fetch(backendUrl, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(patchReq),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to patch binding: ${errText}`);
  }

  return await res.json();
}
