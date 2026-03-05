import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  fetchAllPages,
} from '@openchoreo/openchoreo-client-node';
import type {
  APIResponse,
  ListResponse,
  TraitResponse,
  ComponentTraitResponse,
  UpdateComponentTraitsRequest as UpdateTraitsRequest,
} from '@openchoreo/backstage-plugin-common';
import {
  getName,
  getDisplayName,
  getDescription,
  getCreatedAt,
} from '../transformers/common';

// Type definitions matching the API response structure
type TraitListResponse = APIResponse & {
  data?: ListResponse & {
    items?: TraitResponse[];
  };
};

type TraitSchemaResponse = APIResponse & {
  data?: {
    [key: string]: unknown;
  };
};

export type ComponentTrait = ComponentTraitResponse;
export type UpdateComponentTraitsRequest = UpdateTraitsRequest;

export class TraitInfoService {
  private logger: LoggerService;
  private baseUrl: string;

  constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
  }

  async fetchTraits(
    namespaceName: string,
    _page: number = 1,
    _pageSize: number = 100,
    token?: string,
  ): Promise<TraitListResponse> {
    this.logger.debug(`Fetching traits for namespace: ${namespaceName}`);

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
    this.logger.debug(
      `Fetching schema for trait: ${traitName} in namespace: ${namespaceName}`,
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
    _projectName: string,
    componentName: string,
    userToken?: string,
  ): Promise<ComponentTrait[]> {
    this.logger.debug(
      `Fetching component traits for: ${componentName} in namespace: ${namespaceName}`,
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
    _projectName: string,
    componentName: string,
    traits: UpdateComponentTraitsRequest,
    userToken?: string,
  ): Promise<ComponentTrait[]> {
    this.logger.debug(
      `Updating component traits for: ${componentName} in namespace: ${namespaceName}`,
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
      } as typeof component;

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
