import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoLegacyApiClient,
  type OpenChoreoLegacyComponents,
} from '@openchoreo/openchoreo-client-node';

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

  constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
  }

  async fetchTraits(
    namespaceName: string,
    page: number = 1,
    pageSize: number = 100,
    token?: string,
  ): Promise<TraitListResponse> {
    this.logger.debug(
      `Fetching traits (traits) for namespace: ${namespaceName} (page: ${page}, pageSize: ${pageSize})`,
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

  async fetchTraitSchema(
    namespaceName: string,
    traitName: string,
    token?: string,
  ): Promise<TraitSchemaResponse> {
    this.logger.debug(
      `Fetching schema for trait (trait): ${traitName} in namespace: ${namespaceName}`,
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

  async fetchComponentTraits(
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

  async updateComponentTraits(
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
}
