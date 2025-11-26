import { Entity } from '@backstage/catalog-model';
import { DiscoveryApi, IdentityApi } from '@backstage/core-plugin-api';
import { API_ENDPOINTS } from '../constants';
import { apiFetch } from './client';
import {
  extractEntityMetadata,
  tryExtractEntityMetadata,
  entityMetadataToParams,
} from '../utils/entityUtils';

/** Schema response containing component-type and trait environment override schemas */
interface ComponentSchemaResponse {
  componentTypeEnvOverrides?: {
    [key: string]: unknown;
  };
  traitOverrides?: {
    [key: string]: {
      [key: string]: unknown;
    };
  };
}

/** Release binding item */
export interface ReleaseBinding {
  name: string;
  environment: string;
  componentTypeEnvOverrides?: unknown;
  traitOverrides?: unknown;
  workloadOverrides?: unknown;
}

/** Release bindings response */
interface ReleaseBindingsResponse {
  success: boolean;
  data?: {
    items: ReleaseBinding[];
  };
}

/** Create release response */
export interface CreateReleaseResponse {
  success: boolean;
  data?: {
    name: string;
  };
}

export async function fetchEnvironmentInfo(
  entity: Entity,
  discovery: DiscoveryApi,
  identity: IdentityApi,
) {
  const metadata = tryExtractEntityMetadata(entity);
  if (!metadata) {
    return [];
  }

  return apiFetch({
    endpoint: API_ENDPOINTS.ENVIRONMENT_INFO,
    discovery,
    identity,
    params: entityMetadataToParams(metadata),
  });
}

export async function promoteToEnvironment(
  entity: Entity,
  discovery: DiscoveryApi,
  identity: IdentityApi,
  sourceEnvironment: string,
  targetEnvironment: string,
) {
  const { component, project, organization } = extractEntityMetadata(entity);

  return apiFetch({
    endpoint: API_ENDPOINTS.PROMOTE_DEPLOYMENT,
    discovery,
    identity,
    method: 'POST',
    body: {
      sourceEnv: sourceEnvironment,
      targetEnv: targetEnvironment,
      componentName: component,
      projectName: project,
      orgName: organization,
    },
  });
}

export async function deleteReleaseBinding(
  entity: Entity,
  discovery: DiscoveryApi,
  identity: IdentityApi,
  environment: string,
) {
  const { component, project, organization } = extractEntityMetadata(entity);

  return apiFetch({
    endpoint: API_ENDPOINTS.DELETE_RELEASE_BINDING,
    discovery,
    identity,
    method: 'DELETE',
    body: {
      orgName: organization,
      projectName: project,
      componentName: component,
      environment,
    },
  });
}

export async function updateComponentBinding(
  entity: Entity,
  discovery: DiscoveryApi,
  identity: IdentityApi,
  bindingName: string,
  releaseState: 'Active' | 'Suspend' | 'Undeploy',
) {
  const { component, project, organization } = extractEntityMetadata(entity);

  return apiFetch({
    endpoint: API_ENDPOINTS.UPDATE_BINDING,
    discovery,
    identity,
    method: 'PATCH',
    body: {
      orgName: organization,
      projectName: project,
      componentName: component,
      bindingName,
      releaseState,
    },
  });
}

export async function createComponentRelease(
  entity: Entity,
  discovery: DiscoveryApi,
  identity: IdentityApi,
  releaseName?: string,
): Promise<CreateReleaseResponse> {
  const metadata = extractEntityMetadata(entity);

  return apiFetch<CreateReleaseResponse>({
    endpoint: API_ENDPOINTS.CREATE_RELEASE,
    discovery,
    identity,
    method: 'POST',
    params: entityMetadataToParams(metadata),
    body: { releaseName },
  });
}

export async function deployRelease(
  entity: Entity,
  discovery: DiscoveryApi,
  identity: IdentityApi,
  releaseName: string,
) {
  const metadata = extractEntityMetadata(entity);

  return apiFetch({
    endpoint: API_ENDPOINTS.DEPLOY_RELEASE,
    discovery,
    identity,
    method: 'POST',
    params: entityMetadataToParams(metadata),
    body: { releaseName },
  });
}

export async function fetchComponentReleaseSchema(
  entity: Entity,
  discovery: DiscoveryApi,
  identity: IdentityApi,
  releaseName: string,
): Promise<{
  success: boolean;
  message: string;
  data?: ComponentSchemaResponse;
}> {
  const metadata = extractEntityMetadata(entity);

  return apiFetch({
    endpoint: API_ENDPOINTS.COMPONENT_RELEASE_SCHEMA,
    discovery,
    identity,
    params: {
      ...entityMetadataToParams(metadata),
      releaseName,
    },
  });
}

export async function fetchReleaseBindings(
  entity: Entity,
  discovery: DiscoveryApi,
  identity: IdentityApi,
): Promise<ReleaseBindingsResponse> {
  const metadata = extractEntityMetadata(entity);

  return apiFetch<ReleaseBindingsResponse>({
    endpoint: API_ENDPOINTS.RELEASE_BINDINGS,
    discovery,
    identity,
    params: entityMetadataToParams(metadata),
  });
}

export async function patchReleaseBindingOverrides(
  entity: Entity,
  discovery: DiscoveryApi,
  identity: IdentityApi,
  environment: string,
  componentTypeEnvOverrides?: unknown,
  traitOverrides?: unknown,
  workloadOverrides?: any,
) {
  const { component, project, organization } = extractEntityMetadata(entity);

  const patchReq: Record<string, unknown> = {
    orgName: organization,
    projectName: project,
    componentName: component,
    environment,
  };

  if (componentTypeEnvOverrides !== undefined) {
    patchReq.componentTypeEnvOverrides = componentTypeEnvOverrides;
  }
  if (traitOverrides !== undefined) {
    patchReq.traitOverrides = traitOverrides;
  }
  if (workloadOverrides !== undefined) {
    patchReq.workloadOverrides = workloadOverrides;
  }

  return apiFetch({
    endpoint: API_ENDPOINTS.PATCH_RELEASE_BINDING,
    discovery,
    identity,
    method: 'PATCH',
    body: patchReq,
  });
}

export async function fetchEnvironmentRelease(
  entity: Entity,
  discovery: DiscoveryApi,
  identity: IdentityApi,
  environmentName: string,
) {
  const metadata = extractEntityMetadata(entity);

  return apiFetch({
    endpoint: API_ENDPOINTS.ENVIRONMENT_RELEASE,
    discovery,
    identity,
    params: {
      ...entityMetadataToParams(metadata),
      environmentName,
    },
  });
}
