import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  type OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';

// Type for GET definition response - returns full CRD as unstructured JSON
type ResourceDefinitionResponse =
  OpenChoreoComponents['schemas']['APIResponse'] & {
    data?: {
      [key: string]: unknown;
    };
  };

// Type for PUT/DELETE response
type ResourceCRUDResponse = OpenChoreoComponents['schemas']['APIResponse'] & {
  data?: OpenChoreoComponents['schemas']['ResourceCRUDResponse'];
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

export class PlatformResourceService {
  private logger: LoggerService;
  private baseUrl: string;

  constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
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
    this.logger.debug(
      `Fetching ${kind} definition: ${resourceName} in namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      let data: ResourceDefinitionResponse | undefined;
      let error: unknown;
      let response: Response;

      // Call the appropriate endpoint based on kind
      switch (kind) {
        case 'component-types': {
          const result = await client.GET(
            '/namespaces/{namespaceName}/component-types/{ctName}/definition',
            {
              params: {
                path: { namespaceName, ctName: resourceName },
              },
            },
          );
          data = result.data as ResourceDefinitionResponse;
          error = result.error;
          response = result.response;
          break;
        }
        case 'traits': {
          const result = await client.GET(
            '/namespaces/{namespaceName}/traits/{traitName}/definition',
            {
              params: {
                path: { namespaceName, traitName: resourceName },
              },
            },
          );
          data = result.data as ResourceDefinitionResponse;
          error = result.error;
          response = result.response;
          break;
        }
        case 'workflows': {
          const result = await client.GET(
            '/namespaces/{namespaceName}/workflows/{workflowName}/definition',
            {
              params: {
                path: { namespaceName, workflowName: resourceName },
              },
            },
          );
          data = result.data as ResourceDefinitionResponse;
          error = result.error;
          response = result.response;
          break;
        }
        case 'component-workflows': {
          const result = await client.GET(
            '/namespaces/{namespaceName}/component-workflows/{cwName}/definition',
            {
              params: {
                path: { namespaceName, cwName: resourceName },
              },
            },
          );
          data = result.data as ResourceDefinitionResponse;
          error = result.error;
          response = result.response;
          break;
        }
        // Kinds whose /definition endpoints are not yet in the typed OpenAPI spec.
        // Use raw fetch until the spec is updated, then migrate to typed client calls.
        case 'environments':
        case 'dataplanes':
        case 'buildplanes':
        case 'observabilityplanes':
        case 'deploymentpipelines': {
          const url = `${this.baseUrl}/namespaces/${encodeURIComponent(namespaceName)}/${kind}/${encodeURIComponent(resourceName)}/definition`;
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };
          if (token) {
            headers.Authorization = `Bearer ${token}`;
          }
          response = await fetch(url, { method: 'GET', headers });
          if (!response.ok) {
            throw new Error(
              `Failed to fetch ${kind} definition: ${response.status} ${response.statusText}`,
            );
          }
          data = (await response.json()) as ResourceDefinitionResponse;
          error = undefined;
          break;
        }
        default:
          throw new Error(`Unsupported resource kind: ${kind}`);
      }

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch ${kind} definition: ${response.status} ${response.statusText}`,
        );
      }

      if (!data?.success) {
        throw new Error('API request was not successful');
      }

      this.logger.debug(
        `Successfully fetched ${kind} definition: ${resourceName}`,
      );
      return data;
    } catch (error) {
      this.logger.error(
        `Failed to fetch ${kind} definition for ${resourceName} in namespace ${namespaceName}: ${error}`,
      );
      throw error;
    }
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
    this.logger.debug(
      `Updating ${kind} definition: ${resourceName} in namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      let data: ResourceCRUDResponse | undefined;
      let error: unknown;
      let response: Response;

      // Call the appropriate endpoint based on kind
      switch (kind) {
        case 'component-types': {
          const result = await client.PUT(
            '/namespaces/{namespaceName}/component-types/{ctName}/definition',
            {
              params: {
                path: { namespaceName, ctName: resourceName },
              },
              body: resource,
            },
          );
          data = result.data as ResourceCRUDResponse;
          error = result.error;
          response = result.response;
          break;
        }
        case 'traits': {
          const result = await client.PUT(
            '/namespaces/{namespaceName}/traits/{traitName}/definition',
            {
              params: {
                path: { namespaceName, traitName: resourceName },
              },
              body: resource,
            },
          );
          data = result.data as ResourceCRUDResponse;
          error = result.error;
          response = result.response;
          break;
        }
        case 'workflows': {
          const result = await client.PUT(
            '/namespaces/{namespaceName}/workflows/{workflowName}/definition',
            {
              params: {
                path: { namespaceName, workflowName: resourceName },
              },
              body: resource,
            },
          );
          data = result.data as ResourceCRUDResponse;
          error = result.error;
          response = result.response;
          break;
        }
        case 'component-workflows': {
          const result = await client.PUT(
            '/namespaces/{namespaceName}/component-workflows/{cwName}/definition',
            {
              params: {
                path: { namespaceName, cwName: resourceName },
              },
              body: resource,
            },
          );
          data = result.data as ResourceCRUDResponse;
          error = result.error;
          response = result.response;
          break;
        }
        case 'environments':
        case 'dataplanes':
        case 'buildplanes':
        case 'observabilityplanes':
        case 'deploymentpipelines': {
          const url = `${this.baseUrl}/namespaces/${encodeURIComponent(namespaceName)}/${kind}/${encodeURIComponent(resourceName)}/definition`;
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };
          if (token) {
            headers.Authorization = `Bearer ${token}`;
          }
          response = await fetch(url, {
            method: 'PUT',
            headers,
            body: JSON.stringify(resource),
          });
          if (!response.ok) {
            throw new Error(
              `Failed to update ${kind} definition: ${response.status} ${response.statusText}`,
            );
          }
          data = (await response.json()) as ResourceCRUDResponse;
          error = undefined;
          break;
        }
        default:
          throw new Error(`Unsupported resource kind: ${kind}`);
      }

      if (error || !response.ok) {
        throw new Error(
          `Failed to update ${kind} definition: ${response.status} ${response.statusText}`,
        );
      }

      if (!data?.success) {
        throw new Error('API request was not successful');
      }

      this.logger.debug(
        `Successfully updated ${kind} definition: ${resourceName}`,
      );
      return data;
    } catch (error) {
      this.logger.error(
        `Failed to update ${kind} definition for ${resourceName} in namespace ${namespaceName}: ${error}`,
      );
      throw error;
    }
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
    this.logger.debug(
      `Deleting ${kind} definition: ${resourceName} in namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      let data: ResourceCRUDResponse | undefined;
      let error: unknown;
      let response: Response;

      // Call the appropriate endpoint based on kind
      switch (kind) {
        case 'component-types': {
          const result = await client.DELETE(
            '/namespaces/{namespaceName}/component-types/{ctName}/definition',
            {
              params: {
                path: { namespaceName, ctName: resourceName },
              },
            },
          );
          data = result.data as ResourceCRUDResponse;
          error = result.error;
          response = result.response;
          break;
        }
        case 'traits': {
          const result = await client.DELETE(
            '/namespaces/{namespaceName}/traits/{traitName}/definition',
            {
              params: {
                path: { namespaceName, traitName: resourceName },
              },
            },
          );
          data = result.data as ResourceCRUDResponse;
          error = result.error;
          response = result.response;
          break;
        }
        case 'workflows': {
          const result = await client.DELETE(
            '/namespaces/{namespaceName}/workflows/{workflowName}/definition',
            {
              params: {
                path: { namespaceName, workflowName: resourceName },
              },
            },
          );
          data = result.data as ResourceCRUDResponse;
          error = result.error;
          response = result.response;
          break;
        }
        case 'component-workflows': {
          const result = await client.DELETE(
            '/namespaces/{namespaceName}/component-workflows/{cwName}/definition',
            {
              params: {
                path: { namespaceName, cwName: resourceName },
              },
            },
          );
          data = result.data as ResourceCRUDResponse;
          error = result.error;
          response = result.response;
          break;
        }
        case 'environments':
        case 'dataplanes':
        case 'buildplanes':
        case 'observabilityplanes':
        case 'deploymentpipelines': {
          const url = `${this.baseUrl}/namespaces/${encodeURIComponent(namespaceName)}/${kind}/${encodeURIComponent(resourceName)}/definition`;
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };
          if (token) {
            headers.Authorization = `Bearer ${token}`;
          }
          response = await fetch(url, { method: 'DELETE', headers });
          if (!response.ok) {
            throw new Error(
              `Failed to delete ${kind} definition: ${response.status} ${response.statusText}`,
            );
          }
          data = (await response.json()) as ResourceCRUDResponse;
          error = undefined;
          break;
        }
        default:
          throw new Error(`Unsupported resource kind: ${kind}`);
      }

      if (error || !response.ok) {
        throw new Error(
          `Failed to delete ${kind} definition: ${response.status} ${response.statusText}`,
        );
      }

      if (!data?.success) {
        throw new Error('API request was not successful');
      }

      this.logger.debug(
        `Successfully deleted ${kind} definition: ${resourceName}`,
      );
      return data;
    } catch (error) {
      this.logger.error(
        `Failed to delete ${kind} definition for ${resourceName} in namespace ${namespaceName}: ${error}`,
      );
      throw error;
    }
  }
}
