import { LoggerService } from '@backstage/backend-plugin-api';
import { createOpenChoreoApiClient } from '@openchoreo/openchoreo-client-node';

// Type for GET definition response - returns full CRD as unstructured JSON
type ResourceDefinitionResponse = {
  success?: boolean;
  data?: {
    [key: string]: unknown;
  };
};

// Type for PUT/DELETE response
type ResourceCRUDResponse = {
  success?: boolean;
  data?: {
    operation?: string;
    name?: string;
    kind?: string;
    apiVersion?: string;
    namespace?: string;
  };
};

// Supported resource kinds and their API path segments
type ResourceKind =
  | 'component-types'
  | 'traits'
  | 'workflows'
  | 'component-workflows'
  | 'environments'
  | 'dataplanes'
  | 'buildplanes'
  | 'observabilityplanes'
  | 'deploymentpipelines';

// Mapping from ResourceKind to CRD kind (PascalCase)
const RESOURCE_KIND_TO_CRD_KIND: Record<ResourceKind, string> = {
  'component-types': 'ComponentType',
  traits: 'Trait',
  workflows: 'Workflow',
  'component-workflows': 'ComponentWorkflow',
  environments: 'Environment',
  dataplanes: 'DataPlane',
  buildplanes: 'BuildPlane',
  observabilityplanes: 'ObservabilityPlane',
  deploymentpipelines: 'DeploymentPipeline',
};

// Resource kinds that have full CRUD in the new API
const NEW_API_KINDS: ReadonlySet<ResourceKind> = new Set([
  'environments',
  'dataplanes',
  'buildplanes',
  'observabilityplanes',
  'workflows',
  'deploymentpipelines',
]);

// TODO: Migrate to new API when individual CRUD endpoints are available
// Currently only list + schema endpoints exist for: component-types, traits, component-workflows

export class PlatformResourceService {
  private logger: LoggerService;
  private baseUrl: string;
  private useNewApi: boolean;

  constructor(logger: LoggerService, baseUrl: string, useNewApi: boolean) {
    this.logger = logger;
    this.baseUrl = baseUrl;
    this.useNewApi = useNewApi;
  }

  private createNewClient(token?: string) {
    return createOpenChoreoApiClient({
      baseUrl: this.baseUrl,
      token,
      logger: this.logger,
    });
  }

  private kindHasNewApi(kind: ResourceKind): boolean {
    return NEW_API_KINDS.has(kind);
  }

  private getCrdKind(kind: ResourceKind): string {
    const crdKind = RESOURCE_KIND_TO_CRD_KIND[kind];
    if (!crdKind) {
      throw new Error(`Unsupported resource kind: ${kind}`);
    }
    return crdKind;
  }

  private buildHeaders(token?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * Get the full CRD definition for a platform resource
   */
  async getResourceDefinition(
    kind: ResourceKind,
    namespaceName: string,
    resourceName: string,
    token?: string,
  ): Promise<ResourceDefinitionResponse> {
    if (this.useNewApi && this.kindHasNewApi(kind)) {
      return this.getResourceDefinitionNew(
        kind,
        namespaceName,
        resourceName,
        token,
      );
    }
    return this.getResourceDefinitionLegacy(
      kind,
      namespaceName,
      resourceName,
      token,
    );
  }

  /**
   * Update (or create) a platform resource definition
   */
  async updateResourceDefinition(
    kind: ResourceKind,
    namespaceName: string,
    resourceName: string,
    resource: Record<string, unknown>,
    token?: string,
  ): Promise<ResourceCRUDResponse> {
    if (this.useNewApi && this.kindHasNewApi(kind)) {
      return this.updateResourceDefinitionNew(
        kind,
        namespaceName,
        resourceName,
        resource,
        token,
      );
    }
    return this.updateResourceDefinitionLegacy(
      kind,
      namespaceName,
      resourceName,
      resource,
      token,
    );
  }

  /**
   * Delete a platform resource definition
   */
  async deleteResourceDefinition(
    kind: ResourceKind,
    namespaceName: string,
    resourceName: string,
    token?: string,
  ): Promise<ResourceCRUDResponse> {
    if (this.useNewApi && this.kindHasNewApi(kind)) {
      return this.deleteResourceDefinitionNew(
        kind,
        namespaceName,
        resourceName,
        token,
      );
    }
    return this.deleteResourceDefinitionLegacy(
      kind,
      namespaceName,
      resourceName,
      token,
    );
  }

  // ---------------------------------------------------------------------------
  // New API methods
  // ---------------------------------------------------------------------------

  private async getResourceDefinitionNew(
    kind: ResourceKind,
    namespaceName: string,
    resourceName: string,
    token?: string,
  ): Promise<ResourceDefinitionResponse> {
    const crdKind = this.getCrdKind(kind);
    this.logger.debug(
      `Fetching ${crdKind} definition via new API: ${resourceName} in namespace: ${namespaceName}`,
    );

    try {
      const client = this.createNewClient(token);
      let resource: Record<string, unknown>;

      switch (kind) {
        case 'environments': {
          const { data, error, response } = await client.GET(
            '/api/v1/namespaces/{namespaceName}/environments/{envName}',
            {
              params: {
                path: { namespaceName, envName: resourceName },
              },
            },
          );
          if (error || !response.ok) {
            throw new Error(
              `Failed to fetch ${crdKind} definition: ${response.status} ${response.statusText}`,
            );
          }
          resource = data as Record<string, unknown>;
          break;
        }
        case 'dataplanes': {
          const { data, error, response } = await client.GET(
            '/api/v1/namespaces/{namespaceName}/dataplanes/{dpName}',
            {
              params: {
                path: { namespaceName, dpName: resourceName },
              },
            },
          );
          if (error || !response.ok) {
            throw new Error(
              `Failed to fetch ${crdKind} definition: ${response.status} ${response.statusText}`,
            );
          }
          resource = data as Record<string, unknown>;
          break;
        }
        case 'buildplanes': {
          const { data, error, response } = await client.GET(
            '/api/v1/namespaces/{namespaceName}/buildplanes/{bpName}',
            {
              params: {
                path: { namespaceName, bpName: resourceName },
              },
            },
          );
          if (error || !response.ok) {
            throw new Error(
              `Failed to fetch ${crdKind} definition: ${response.status} ${response.statusText}`,
            );
          }
          resource = data as Record<string, unknown>;
          break;
        }
        case 'observabilityplanes': {
          const { data, error, response } = await client.GET(
            '/api/v1/namespaces/{namespaceName}/observabilityplanes/{opName}',
            {
              params: {
                path: { namespaceName, opName: resourceName },
              },
            },
          );
          if (error || !response.ok) {
            throw new Error(
              `Failed to fetch ${crdKind} definition: ${response.status} ${response.statusText}`,
            );
          }
          resource = data as Record<string, unknown>;
          break;
        }
        case 'workflows': {
          const { data, error, response } = await client.GET(
            '/api/v1/namespaces/{namespaceName}/workflows/{workflowName}',
            {
              params: {
                path: { namespaceName, workflowName: resourceName },
              },
            },
          );
          if (error || !response.ok) {
            throw new Error(
              `Failed to fetch ${crdKind} definition: ${response.status} ${response.statusText}`,
            );
          }
          resource = data as Record<string, unknown>;
          break;
        }
        case 'deploymentpipelines': {
          const { data, error, response } = await client.GET(
            '/api/v1/namespaces/{namespaceName}/deployment-pipelines/{pipelineName}',
            {
              params: {
                path: { namespaceName, pipelineName: resourceName },
              },
            },
          );
          if (error || !response.ok) {
            throw new Error(
              `Failed to fetch ${crdKind} definition: ${response.status} ${response.statusText}`,
            );
          }
          resource = data as Record<string, unknown>;
          break;
        }
        default:
          throw new Error(
            `Resource kind '${kind}' is not supported in the new API`,
          );
      }

      this.logger.debug(
        `Successfully fetched ${crdKind} definition: ${resourceName}`,
      );
      return { success: true, data: resource };
    } catch (error) {
      this.logger.error(
        `Failed to fetch ${crdKind} definition for ${resourceName} in namespace ${namespaceName}: ${error}`,
      );
      throw error;
    }
  }

  private async updateResourceDefinitionNew(
    kind: ResourceKind,
    namespaceName: string,
    resourceName: string,
    resource: Record<string, unknown>,
    token?: string,
  ): Promise<ResourceCRUDResponse> {
    const crdKind = this.getCrdKind(kind);
    this.logger.debug(
      `Updating ${crdKind} definition via new API: ${resourceName} in namespace: ${namespaceName}`,
    );

    try {
      const client = this.createNewClient(token);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body = resource as any;

      switch (kind) {
        case 'environments': {
          const { error, response } = await client.PUT(
            '/api/v1/namespaces/{namespaceName}/environments/{envName}',
            {
              params: {
                path: { namespaceName, envName: resourceName },
              },
              body,
            },
          );
          if (error || !response.ok) {
            throw new Error(
              `Failed to update ${crdKind} definition: ${response.status} ${response.statusText}`,
            );
          }
          break;
        }
        case 'dataplanes': {
          const { error, response } = await client.PUT(
            '/api/v1/namespaces/{namespaceName}/dataplanes/{dpName}',
            {
              params: {
                path: { namespaceName, dpName: resourceName },
              },
              body,
            },
          );
          if (error || !response.ok) {
            throw new Error(
              `Failed to update ${crdKind} definition: ${response.status} ${response.statusText}`,
            );
          }
          break;
        }
        case 'buildplanes': {
          const { error, response } = await client.PUT(
            '/api/v1/namespaces/{namespaceName}/buildplanes/{bpName}',
            {
              params: {
                path: { namespaceName, bpName: resourceName },
              },
              body,
            },
          );
          if (error || !response.ok) {
            throw new Error(
              `Failed to update ${crdKind} definition: ${response.status} ${response.statusText}`,
            );
          }
          break;
        }
        case 'observabilityplanes': {
          const { error, response } = await client.PUT(
            '/api/v1/namespaces/{namespaceName}/observabilityplanes/{opName}',
            {
              params: {
                path: { namespaceName, opName: resourceName },
              },
              body,
            },
          );
          if (error || !response.ok) {
            throw new Error(
              `Failed to update ${crdKind} definition: ${response.status} ${response.statusText}`,
            );
          }
          break;
        }
        case 'workflows': {
          const { error, response } = await client.PUT(
            '/api/v1/namespaces/{namespaceName}/workflows/{workflowName}',
            {
              params: {
                path: { namespaceName, workflowName: resourceName },
              },
              body,
            },
          );
          if (error || !response.ok) {
            throw new Error(
              `Failed to update ${crdKind} definition: ${response.status} ${response.statusText}`,
            );
          }
          break;
        }
        case 'deploymentpipelines': {
          const { error, response } = await client.PUT(
            '/api/v1/namespaces/{namespaceName}/deployment-pipelines/{pipelineName}',
            {
              params: {
                path: { namespaceName, pipelineName: resourceName },
              },
              body,
            },
          );
          if (error || !response.ok) {
            throw new Error(
              `Failed to update ${crdKind} definition: ${response.status} ${response.statusText}`,
            );
          }
          break;
        }
        default:
          throw new Error(
            `Resource kind '${kind}' is not supported in the new API`,
          );
      }

      this.logger.debug(
        `Successfully updated ${crdKind} definition: ${resourceName}`,
      );
      return {
        success: true,
        data: {
          operation: 'updated',
          name: resourceName,
          kind: crdKind,
          namespace: namespaceName,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to update ${crdKind} definition for ${resourceName} in namespace ${namespaceName}: ${error}`,
      );
      throw error;
    }
  }

  private async deleteResourceDefinitionNew(
    kind: ResourceKind,
    namespaceName: string,
    resourceName: string,
    token?: string,
  ): Promise<ResourceCRUDResponse> {
    const crdKind = this.getCrdKind(kind);
    this.logger.debug(
      `Deleting ${crdKind} definition via new API: ${resourceName} in namespace: ${namespaceName}`,
    );

    try {
      const client = this.createNewClient(token);

      switch (kind) {
        case 'environments': {
          const { error, response } = await client.DELETE(
            '/api/v1/namespaces/{namespaceName}/environments/{envName}',
            {
              params: {
                path: { namespaceName, envName: resourceName },
              },
            },
          );
          if (error || !response.ok) {
            throw new Error(
              `Failed to delete ${crdKind} definition: ${response.status} ${response.statusText}`,
            );
          }
          break;
        }
        case 'dataplanes': {
          const { error, response } = await client.DELETE(
            '/api/v1/namespaces/{namespaceName}/dataplanes/{dpName}',
            {
              params: {
                path: { namespaceName, dpName: resourceName },
              },
            },
          );
          if (error || !response.ok) {
            throw new Error(
              `Failed to delete ${crdKind} definition: ${response.status} ${response.statusText}`,
            );
          }
          break;
        }
        case 'buildplanes': {
          const { error, response } = await client.DELETE(
            '/api/v1/namespaces/{namespaceName}/buildplanes/{bpName}',
            {
              params: {
                path: { namespaceName, bpName: resourceName },
              },
            },
          );
          if (error || !response.ok) {
            throw new Error(
              `Failed to delete ${crdKind} definition: ${response.status} ${response.statusText}`,
            );
          }
          break;
        }
        case 'observabilityplanes': {
          const { error, response } = await client.DELETE(
            '/api/v1/namespaces/{namespaceName}/observabilityplanes/{opName}',
            {
              params: {
                path: { namespaceName, opName: resourceName },
              },
            },
          );
          if (error || !response.ok) {
            throw new Error(
              `Failed to delete ${crdKind} definition: ${response.status} ${response.statusText}`,
            );
          }
          break;
        }
        case 'workflows': {
          const { error, response } = await client.DELETE(
            '/api/v1/namespaces/{namespaceName}/workflows/{workflowName}',
            {
              params: {
                path: { namespaceName, workflowName: resourceName },
              },
            },
          );
          if (error || !response.ok) {
            throw new Error(
              `Failed to delete ${crdKind} definition: ${response.status} ${response.statusText}`,
            );
          }
          break;
        }
        case 'deploymentpipelines': {
          const { error, response } = await client.DELETE(
            '/api/v1/namespaces/{namespaceName}/deployment-pipelines/{pipelineName}',
            {
              params: {
                path: { namespaceName, pipelineName: resourceName },
              },
            },
          );
          if (error || !response.ok) {
            throw new Error(
              `Failed to delete ${crdKind} definition: ${response.status} ${response.statusText}`,
            );
          }
          break;
        }
        default:
          throw new Error(
            `Resource kind '${kind}' is not supported in the new API`,
          );
      }

      this.logger.debug(
        `Successfully deleted ${crdKind} definition: ${resourceName}`,
      );
      return {
        success: true,
        data: {
          operation: 'deleted',
          name: resourceName,
          kind: crdKind,
          namespace: namespaceName,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to delete ${crdKind} definition for ${resourceName} in namespace ${namespaceName}: ${error}`,
      );
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Legacy API methods
  // ---------------------------------------------------------------------------

  private async getResourceDefinitionLegacy(
    kind: ResourceKind,
    namespaceName: string,
    resourceName: string,
    token?: string,
  ): Promise<ResourceDefinitionResponse> {
    const crdKind = this.getCrdKind(kind);

    this.logger.debug(
      `Fetching ${crdKind} definition: ${resourceName} in namespace: ${namespaceName}`,
    );

    try {
      const url = `${this.baseUrl}/namespaces/${encodeURIComponent(
        namespaceName,
      )}/resources/${encodeURIComponent(crdKind)}/${encodeURIComponent(
        resourceName,
      )}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.buildHeaders(token),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch ${crdKind} definition: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as ResourceDefinitionResponse;

      if (!data?.success) {
        throw new Error('API request was not successful');
      }

      this.logger.debug(
        `Successfully fetched ${crdKind} definition: ${resourceName}`,
      );
      return data;
    } catch (error) {
      this.logger.error(
        `Failed to fetch ${crdKind} definition for ${resourceName} in namespace ${namespaceName}: ${error}`,
      );
      throw error;
    }
  }

  private async updateResourceDefinitionLegacy(
    kind: ResourceKind,
    namespaceName: string,
    resourceName: string,
    resource: Record<string, unknown>,
    token?: string,
  ): Promise<ResourceCRUDResponse> {
    const crdKind = this.getCrdKind(kind);

    this.logger.debug(
      `Applying ${crdKind} definition: ${resourceName} in namespace: ${namespaceName}`,
    );

    try {
      const url = `${this.baseUrl}/apply`;
      const response = await fetch(url, {
        method: 'POST',
        headers: this.buildHeaders(token),
        body: JSON.stringify(resource),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to apply ${crdKind} definition: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as ResourceCRUDResponse;

      if (!data?.success) {
        throw new Error('API request was not successful');
      }

      this.logger.debug(
        `Successfully applied ${crdKind} definition: ${resourceName}`,
      );
      return data;
    } catch (error) {
      this.logger.error(
        `Failed to apply ${crdKind} definition for ${resourceName} in namespace ${namespaceName}: ${error}`,
      );
      throw error;
    }
  }

  private async deleteResourceDefinitionLegacy(
    kind: ResourceKind,
    namespaceName: string,
    resourceName: string,
    token?: string,
  ): Promise<ResourceCRUDResponse> {
    const crdKind = this.getCrdKind(kind);

    this.logger.debug(
      `Deleting ${crdKind} definition: ${resourceName} in namespace: ${namespaceName}`,
    );

    try {
      const url = `${this.baseUrl}/delete`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: this.buildHeaders(token),
        body: JSON.stringify({
          apiVersion: 'openchoreo.dev/v1alpha1',
          kind: crdKind,
          metadata: {
            name: resourceName,
            namespace: namespaceName,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to delete ${crdKind} definition: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as ResourceCRUDResponse;

      if (!data?.success) {
        throw new Error('API request was not successful');
      }

      this.logger.debug(
        `Successfully deleted ${crdKind} definition: ${resourceName}`,
      );
      return data;
    } catch (error) {
      this.logger.error(
        `Failed to delete ${crdKind} definition for ${resourceName} in namespace ${namespaceName}: ${error}`,
      );
      throw error;
    }
  }
}
