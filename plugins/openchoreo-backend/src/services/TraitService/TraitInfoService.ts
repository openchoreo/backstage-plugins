import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  type OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';

// Type definitions matching the API response structure
type TraitListResponse = OpenChoreoComponents['schemas']['APIResponse'] & {
  data?: OpenChoreoComponents['schemas']['ListResponse'] & {
    items?: OpenChoreoComponents['schemas']['TraitResponse'][];
  };
};

type TraitSchemaResponse = OpenChoreoComponents['schemas']['APIResponse'] & {
  data?: {
    [key: string]: unknown;
  };
};

export class TraitInfoService {
  private logger: LoggerService;
  private baseUrl: string;

  constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
  }

  async fetchTraits(
    orgName: string,
    page: number = 1,
    pageSize: number = 100,
  ): Promise<TraitListResponse> {
    this.logger.debug(
      `Fetching traits (traits) for organization: ${orgName} (page: ${page}, pageSize: ${pageSize})`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/orgs/{orgName}/traits',
        {
          params: {
            path: { orgName },
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
        } traits for org: ${orgName}`,
      );
      return traitListResponse;
    } catch (error) {
      this.logger.error(`Failed to fetch traits for org ${orgName}: ${error}`);
      throw error;
    }
  }

  async fetchTraitSchema(
    orgName: string,
    traitName: string,
  ): Promise<TraitSchemaResponse> {
    this.logger.debug(
      `Fetching schema for trait (trait): ${traitName} in org: ${orgName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
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
}
