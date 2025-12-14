import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  type OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';
import { fetchAllResources, DEFAULT_PAGE_LIMIT } from '@openchoreo/backstage-plugin-common';

// Type definitions matching the API response structure
type TraitListResponse = OpenChoreoComponents['schemas']['APIResponse'] & {
  data?: {
    items?: OpenChoreoComponents['schemas']['TraitResponse'][];
  };
};

type TraitSchemaResponse = OpenChoreoComponents['schemas']['APIResponse'] & {
  data?: {
    [key: string]: unknown;
  };
};

type ComponentTraitListResponse =
  OpenChoreoComponents['schemas']['APIResponse'] & {
    data?: OpenChoreoComponents['schemas']['ListResponse'] & {
      items?: OpenChoreoComponents['schemas']['ComponentTraitResponse'][];
    };
  };

export type ComponentTrait =
  OpenChoreoComponents['schemas']['ComponentTraitResponse'];
export type UpdateComponentTraitsRequest =
  OpenChoreoComponents['schemas']['UpdateComponentTraitsRequest'];

export class TraitInfoService {
  private logger: LoggerService;
  private baseUrl: string;

  constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
  }

  async fetchTraits(orgName: string, token?: string): Promise<TraitListResponse> {
    this.logger.debug(`Fetching traits for organization: ${orgName}`);

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const items = await fetchAllResources(async cursor => {
        const { data, error, response } = await client.GET('/orgs/{orgName}/traits', {
          params: {
            path: { orgName },
            query: {
              limit: DEFAULT_PAGE_LIMIT,
              ...(cursor && { continue: cursor }),
            },
          },
        });

        if (error || !response.ok || !data) {
          throw new Error(
            `Failed to fetch traits: ${response.status} ${response.statusText}`,
          );
        }

        if (!data.success || !data.data?.items) {
          throw new Error('Failed to retrieve traits list');
        }

        return {
          items: data.data.items as OpenChoreoComponents['schemas']['TraitResponse'][],
          metadata: data.data?.metadata,
        };
      });

      this.logger.debug(`Successfully fetched ${items.length} traits for org: ${orgName}`);

      return {
        success: true,
        data: { items },
      } as TraitListResponse;
    } catch (error) {
      this.logger.error(`Failed to fetch traits for org ${orgName}: ${error}`);
      throw error;
    }
  }

  async fetchTraitSchema(
    orgName: string,
    traitName: string,
    token?: string,
  ): Promise<TraitSchemaResponse> {
    this.logger.debug(
      `Fetching schema for trait (trait): ${traitName} in org: ${orgName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/orgs/{orgName}/traits/{traitName}/schema',
        {
          params: {
            path: { orgName, traitName: traitName },
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
        `Failed to fetch schema for trait ${traitName} in org ${orgName}: ${error}`,
      );
      throw error;
    }
  }

  async fetchComponentTraits(
    orgName: string,
    projectName: string,
    componentName: string,
    userToken?: string,
  ): Promise<ComponentTrait[]> {
    this.logger.debug(
      `Fetching component traits for: ${componentName} in project: ${projectName}, organization: ${orgName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token: userToken,
        logger: this.logger,
      });


      const traits = await fetchAllResources(async cursor => {
        const { data, error, response } = await client.GET(
          '/orgs/{orgName}/projects/{projectName}/components/{componentName}/traits',
          {
            params: {
              path: { orgName, projectName, componentName },
              query: {
                limit: DEFAULT_PAGE_LIMIT,
                ...(cursor && { continue: cursor }),
              },
            },
          },
        );

        if (error || !response.ok || !data) {
          throw new Error(
            `Failed to fetch component traits: ${response.status} ${response.statusText}`,
          );
        }

        if (!data.success || !data.data?.items) {
          return { items: [], metadata: data.data?.metadata };
        }

        return {
          items: data.data.items as OpenChoreoComponents['schemas']['ComponentTraitResponse'][],
          metadata: data.data?.metadata,
        };
      });

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
    orgName: string,
    projectName: string,
    componentName: string,
    traits: UpdateComponentTraitsRequest,
    userToken?: string,
  ): Promise<ComponentTrait[]> {
    this.logger.debug(
      `Updating component traits for: ${componentName} in project: ${projectName}, organization: ${orgName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token: userToken,
        logger: this.logger,
      });

      const { data, error, response } = await client.PUT(
        '/orgs/{orgName}/projects/{projectName}/components/{componentName}/traits',
        {
          params: {
            path: { orgName, projectName, componentName },
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
