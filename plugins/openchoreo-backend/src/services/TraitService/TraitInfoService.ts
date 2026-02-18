import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoLegacyApiClient,
  createOpenChoreoApiClient,
  fetchAllPages,
  type OpenChoreoLegacyComponents,
} from '@openchoreo/openchoreo-client-node';
import {
  getName,
  getDisplayName,
  getDescription,
  getCreatedAt,
} from '../transformers/common';

// Type definitions matching the API response structure
type TraitListResponse =
  OpenChoreoLegacyComponents['schemas']['APIResponse'] & {
    data?: OpenChoreoLegacyComponents['schemas']['ListResponse'] & {
      items?: OpenChoreoLegacyComponents['schemas']['TraitResponse'][];
    };
  };

type TraitSchemaResponse =
  OpenChoreoLegacyComponents['schemas']['APIResponse'] & {
    data?: {
      [key: string]: unknown;
    };
  };

type ComponentTraitListResponse =
  OpenChoreoLegacyComponents['schemas']['APIResponse'] & {
    data?: OpenChoreoLegacyComponents['schemas']['ListResponse'] & {
      items?: OpenChoreoLegacyComponents['schemas']['ComponentTraitResponse'][];
    };
  };

export type ComponentTrait =
  OpenChoreoLegacyComponents['schemas']['ComponentTraitResponse'];
export type UpdateComponentTraitsRequest =
  OpenChoreoLegacyComponents['schemas']['UpdateComponentTraitsRequest'];

export class TraitInfoService {
  private logger: LoggerService;
  private baseUrl: string;
  private useNewApi: boolean;

  constructor(logger: LoggerService, baseUrl: string, useNewApi = false) {
    this.logger = logger;
    this.baseUrl = baseUrl;
    this.useNewApi = useNewApi;
  }

  async fetchTraits(
    namespaceName: string,
    page: number = 1,
    pageSize: number = 100,
    token?: string,
  ): Promise<TraitListResponse> {
    if (this.useNewApi) {
      return this.fetchTraitsNew(namespaceName, token);
    }
    return this.fetchTraitsLegacy(namespaceName, page, pageSize, token);
  }

  private async fetchTraitsLegacy(
    namespaceName: string,
    page: number = 1,
    pageSize: number = 100,
    token?: string,
  ): Promise<TraitListResponse> {
    this.logger.debug(
      `Fetching traits for namespace: ${namespaceName} (page: ${page}, pageSize: ${pageSize})`,
    );

    try {
      const client = createOpenChoreoLegacyApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/namespaces/{namespaceName}/traits',
        {
          params: {
            path: { namespaceName },
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch traits: ${response.status} ${response.statusText}`,
        );
      }

      if (!data?.success) {
        throw new Error('API request was not successful');
      }

      const traitListResponse: TraitListResponse = data as TraitListResponse;

      this.logger.debug(
        `Successfully fetched ${
          traitListResponse.data?.items?.length || 0
        } traits for namespace: ${namespaceName}`,
      );
      return traitListResponse;
    } catch (error) {
      this.logger.error(
        `Failed to fetch traits for namespace ${namespaceName}: ${error}`,
      );
      throw error;
    }
  }

  private async fetchTraitsNew(
    namespaceName: string,
    token?: string,
  ): Promise<TraitListResponse> {
    this.logger.debug(
      `Fetching traits (new API) for namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const allTraits = await fetchAllPages(cursor =>
        client
          .GET('/api/v1/namespaces/{namespaceName}/traits', {
            params: {
              path: { namespaceName },
              query: { limit: 100, cursor },
            },
          })
          .then(res => {
            if (res.error) {
              throw new Error(
                `Failed to fetch traits: ${res.response.status} ${res.response.statusText}`,
              );
            }
            return res.data;
          }),
      );

      const items = allTraits.map(trait => ({
        name: getName(trait) ?? '',
        displayName: getDisplayName(trait),
        description: getDescription(trait),
        createdAt: getCreatedAt(trait) ?? '',
      }));

      this.logger.debug(
        `Successfully fetched ${items.length} traits for namespace: ${namespaceName}`,
      );

      return {
        success: true,
        data: {
          items,
          total: items.length,
        },
      } as TraitListResponse;
    } catch (error) {
      this.logger.error(
        `Failed to fetch traits for namespace ${namespaceName}: ${error}`,
      );
      throw error;
    }
  }

  async fetchTraitSchema(
    namespaceName: string,
    traitName: string,
    token?: string,
  ): Promise<TraitSchemaResponse> {
    if (this.useNewApi) {
      return this.fetchTraitSchemaNew(namespaceName, traitName, token);
    }
    return this.fetchTraitSchemaLegacy(namespaceName, traitName, token);
  }

  private async fetchTraitSchemaLegacy(
    namespaceName: string,
    traitName: string,
    token?: string,
  ): Promise<TraitSchemaResponse> {
    this.logger.debug(
      `Fetching schema for trait: ${traitName} in namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoLegacyApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/namespaces/{namespaceName}/traits/{traitName}/schema',
        {
          params: {
            path: { namespaceName, traitName: traitName },
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch trait schema: ${response.status} ${response.statusText}`,
        );
      }

      if (!data?.success) {
        throw new Error('API request was not successful');
      }

      const schemaResponse: TraitSchemaResponse = data as TraitSchemaResponse;

      this.logger.debug(`Successfully fetched schema for trait: ${traitName}`);
      return schemaResponse;
    } catch (error) {
      this.logger.error(
        `Failed to fetch schema for trait ${traitName} in namespace ${namespaceName}: ${error}`,
      );
      throw error;
    }
  }

  private async fetchTraitSchemaNew(
    namespaceName: string,
    traitName: string,
    token?: string,
  ): Promise<TraitSchemaResponse> {
    this.logger.debug(
      `Fetching schema (new API) for trait: ${traitName} in namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/traits/{traitName}/schema',
        {
          params: {
            path: { namespaceName, traitName },
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch trait schema: ${response.status} ${response.statusText}`,
        );
      }

      this.logger.debug(`Successfully fetched schema for trait: ${traitName}`);

      // Wrap in legacy response shape
      return {
        success: true,
        data: data,
      } as TraitSchemaResponse;
    } catch (error) {
      this.logger.error(
        `Failed to fetch schema for trait ${traitName} in namespace ${namespaceName}: ${error}`,
      );
      throw error;
    }
  }

  async fetchComponentTraits(
    namespaceName: string,
    projectName: string,
    componentName: string,
    userToken?: string,
  ): Promise<ComponentTrait[]> {
    if (this.useNewApi) {
      return this.fetchComponentTraitsNew(
        namespaceName,
        componentName,
        userToken,
      );
    }
    return this.fetchComponentTraitsLegacy(
      namespaceName,
      projectName,
      componentName,
      userToken,
    );
  }

  private async fetchComponentTraitsLegacy(
    namespaceName: string,
    projectName: string,
    componentName: string,
    userToken?: string,
  ): Promise<ComponentTrait[]> {
    this.logger.debug(
      `Fetching component traits for: ${componentName} in project: ${projectName}, namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoLegacyApiClient({
        baseUrl: this.baseUrl,
        token: userToken,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/namespaces/{namespaceName}/projects/{projectName}/components/{componentName}/traits',
        {
          params: {
            path: { namespaceName, projectName, componentName },
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch component traits: ${response.status} ${response.statusText}`,
        );
      }

      if (!data?.success) {
        throw new Error('API request was not successful');
      }

      const traitListResponse: ComponentTraitListResponse =
        data as ComponentTraitListResponse;
      const traits = traitListResponse.data?.items || [];

      this.logger.debug(
        `Successfully fetched ${traits.length} traits for component: ${componentName}`,
      );
      return traits;
    } catch (error) {
      this.logger.error(
        `Failed to fetch component traits for ${componentName}: ${error}`,
      );
      throw error;
    }
  }

  private async fetchComponentTraitsNew(
    namespaceName: string,
    componentName: string,
    userToken?: string,
  ): Promise<ComponentTrait[]> {
    this.logger.debug(
      `Fetching component traits (new API) for: ${componentName} in namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token: userToken,
        logger: this.logger,
      });

      // In the new API, component traits are part of the Component spec
      const { data, error, response } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/components/{componentName}',
        {
          params: {
            path: { namespaceName, componentName },
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch component: ${response.status} ${response.statusText}`,
        );
      }

      // Extract traits from component spec — shape matches ComponentTrait
      const traits = (data.spec?.traits ?? []) as ComponentTrait[];

      this.logger.debug(
        `Successfully fetched ${traits.length} traits for component: ${componentName}`,
      );
      return traits;
    } catch (error) {
      this.logger.error(
        `Failed to fetch component traits for ${componentName}: ${error}`,
      );
      throw error;
    }
  }

  async updateComponentTraits(
    namespaceName: string,
    projectName: string,
    componentName: string,
    traits: UpdateComponentTraitsRequest,
    userToken?: string,
  ): Promise<ComponentTrait[]> {
    if (this.useNewApi) {
      return this.updateComponentTraitsNew(
        namespaceName,
        componentName,
        traits,
        userToken,
      );
    }
    return this.updateComponentTraitsLegacy(
      namespaceName,
      projectName,
      componentName,
      traits,
      userToken,
    );
  }

  private async updateComponentTraitsLegacy(
    namespaceName: string,
    projectName: string,
    componentName: string,
    traits: UpdateComponentTraitsRequest,
    userToken?: string,
  ): Promise<ComponentTrait[]> {
    this.logger.debug(
      `Updating component traits for: ${componentName} in project: ${projectName}, namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoLegacyApiClient({
        baseUrl: this.baseUrl,
        token: userToken,
        logger: this.logger,
      });

      const { data, error, response } = await client.PUT(
        '/namespaces/{namespaceName}/projects/{projectName}/components/{componentName}/traits',
        {
          params: {
            path: { namespaceName, projectName, componentName },
          },
          body: traits,
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to update component traits: ${response.status} ${response.statusText}`,
        );
      }

      if (!data?.success) {
        throw new Error('API request was not successful');
      }

      const traitListResponse: ComponentTraitListResponse =
        data as ComponentTraitListResponse;
      const updatedTraits = traitListResponse.data?.items || [];

      this.logger.debug(
        `Successfully updated traits for component: ${componentName}`,
      );
      return updatedTraits;
    } catch (error) {
      this.logger.error(
        `Failed to update component traits for ${componentName}: ${error}`,
      );
      throw error;
    }
  }

  private async updateComponentTraitsNew(
    namespaceName: string,
    componentName: string,
    traits: UpdateComponentTraitsRequest,
    userToken?: string,
  ): Promise<ComponentTrait[]> {
    this.logger.debug(
      `Updating component traits (new API) for: ${componentName} in namespace: ${namespaceName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token: userToken,
        logger: this.logger,
      });

      // First fetch the current component to get full spec
      const {
        data: component,
        error: getError,
        response: getResponse,
      } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/components/{componentName}',
        {
          params: {
            path: { namespaceName, componentName },
          },
        },
      );

      if (getError || !getResponse.ok) {
        throw new Error(
          `Failed to fetch component: ${getResponse.status} ${getResponse.statusText}`,
        );
      }

      if (!component.spec?.owner) {
        throw new Error(`Component ${componentName} is missing spec.owner`);
      }

      // Update the component with the new traits
      const updatedComponent = {
        metadata: component.metadata,
        spec: {
          ...component.spec,
          owner: component.spec.owner,
          traits: traits.traits,
        },
      };

      const { data, error, response } = await client.PUT(
        '/api/v1/namespaces/{namespaceName}/components/{componentName}',
        {
          params: {
            path: { namespaceName, componentName },
          },
          body: updatedComponent,
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to update component traits: ${response.status} ${response.statusText}`,
        );
      }

      // Extract updated traits from response
      const updatedTraits = (data.spec?.traits ?? []) as ComponentTrait[];

      this.logger.debug(
        `Successfully updated traits for component: ${componentName}`,
      );
      return updatedTraits;
    } catch (error) {
      this.logger.error(
        `Failed to update component traits for ${componentName}: ${error}`,
      );
      throw error;
    }
  }
}
