import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  type OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';
import {
  fetchAllResources,
  DEFAULT_PAGE_LIMIT,
} from '@openchoreo/backstage-plugin-common';

// Type definition matching the API response structure
type WorkflowSchemaResponse = OpenChoreoComponents['schemas']['APIResponse'] & {
  data?: {
    [key: string]: unknown;
  };
};

type WorkflowListResponse = OpenChoreoComponents['schemas']['APIResponse'] & {
  data: {
    items: OpenChoreoComponents['schemas']['WorkflowResponse'][];
  };
};

export class WorkflowSchemaService {
  private logger: LoggerService;
  private baseUrl: string;

  constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
  }

  /**
   * Fetch list of component workflows for an organization
   */
  async fetchWorkflows(
    orgName: string,
    token?: string,
  ): Promise<WorkflowListResponse> {
    this.logger.debug(`Fetching component workflows for org: ${orgName}`);

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const items = await fetchAllResources(async cursor => {
        const { data, error, response } = await client.GET(
          '/orgs/{orgName}/component-workflows',
          {
            params: {
              path: { orgName },
              query: {
                limit: DEFAULT_PAGE_LIMIT,
                ...(cursor && { continue: cursor }),
              },
            },
          },
        );

        if (error || !response.ok || !data) {
          throw new Error(
            `Failed to fetch component workflows: ${response.status} ${response.statusText}`,
          );
        }

        if (!data.success || !data.data?.items) {
          throw new Error('Failed to retrieve workflows list');
        }

        return {
          items: data.data
            .items as OpenChoreoComponents['schemas']['WorkflowResponse'][],
          metadata: data.data?.metadata,
        };
      });

      this.logger.debug(
        `Successfully fetched ${items.length} component workflows for org: ${orgName}`,
      );

      return {
        success: true,
        data: { items },
      } as WorkflowListResponse;
    } catch (error) {
      this.logger.error(
        `Failed to fetch component workflows for org ${orgName}: ${error}`,
      );
      throw error;
    }
  }

  /**
   * Fetch JSONSchema for a specific component workflow
   */
  async fetchWorkflowSchema(
    orgName: string,
    workflowName: string,
    token?: string,
  ): Promise<WorkflowSchemaResponse> {
    this.logger.debug(
      `Fetching schema for component workflow: ${workflowName} in org: ${orgName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/orgs/{orgName}/component-workflows/{cwName}/schema',
        {
          params: {
            path: { orgName, cwName: workflowName },
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch component workflow schema: ${response.status} ${response.statusText}`,
        );
      }

      if (!data?.success) {
        throw new Error('Failed to fetch component workflow schema');
      }

      const workflowSchema: WorkflowSchemaResponse =
        data as WorkflowSchemaResponse;

      this.logger.debug(
        `Successfully fetched schema for component workflow: ${workflowName}`,
      );
      return workflowSchema;
    } catch (error) {
      this.logger.error(
        `Failed to fetch schema for component workflow ${workflowName} in org ${orgName}: ${error}`,
      );
      throw error;
    }
  }

  /**
   * Update component workflow schema (PATCH)
   */
  async updateComponentWorkflowSchema(
    orgName: string,
    projectName: string,
    componentName: string,
    systemParameters: { [key: string]: unknown },
    parameters?: { [key: string]: unknown },
    token?: string,
  ): Promise<OpenChoreoComponents['schemas']['APIResponse']> {
    this.logger.debug(
      `Updating workflow schema for component: ${componentName} in project: ${projectName}, org: ${orgName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.PATCH(
        '/orgs/{orgName}/projects/{projectName}/components/{componentName}/component-workflow-schema',
        {
          params: {
            path: { orgName, projectName, componentName },
          },
          body: {
            systemParameters: systemParameters as any,
            parameters: parameters as any,
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to update workflow schema: ${response.status} ${response.statusText}`,
        );
      }

      if (!data?.success) {
        throw new Error('Failed to update workflow schema');
      }

      this.logger.debug(
        `Successfully updated workflow schema for component: ${componentName}`,
      );
      return data;
    } catch (error) {
      this.logger.error(
        `Failed to update workflow schema for component ${componentName}: ${error}`,
      );
      throw error;
    }
  }
}
