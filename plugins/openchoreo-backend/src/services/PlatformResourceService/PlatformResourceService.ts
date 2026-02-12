import { LoggerService } from '@backstage/backend-plugin-api';

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

export class PlatformResourceService {
  private logger: LoggerService;
  private baseUrl: string;

  constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
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
   * Uses: GET /namespaces/{namespaceName}/resources/{kind}/{resourceName}
   */
  async getResourceDefinition(
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
      const url = `${this.baseUrl}/namespaces/${encodeURIComponent(namespaceName)}/resources/${encodeURIComponent(crdKind)}/${encodeURIComponent(resourceName)}`;
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

  /**
   * Update (or create) a platform resource definition
   * Uses: POST /apply with the full CRD resource as body
   */
  async updateResourceDefinition(
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

  /**
   * Delete a platform resource definition
   * Uses: DELETE /delete with the resource identifier as body
   */
  async deleteResourceDefinition(
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
