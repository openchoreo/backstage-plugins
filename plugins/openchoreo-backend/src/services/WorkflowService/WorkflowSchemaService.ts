import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  type OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';

// Type definition matching the API response structure
type WorkflowSchemaResponse = OpenChoreoComponents['schemas']['APIResponse'] & {
  data?: {
    [key: string]: unknown;
  };
};

type WorkflowListResponse = OpenChoreoComponents['schemas']['APIResponse'] & {
  data: OpenChoreoComponents['schemas']['ListResponse'] & {
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
   * Fetch list of workflows for an organization
   */
  async fetchWorkflows(orgName: string): Promise<WorkflowListResponse> {
    this.logger.debug(`Fetching workflows for org: ${orgName}`);

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/orgs/{orgName}/workflows',
        {
          params: {
            path: { orgName },
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch workflows: ${response.status} ${response.statusText}`,
        );
      }

      if (!data?.success) {
        throw new Error('Failed to fetch workflows');
      }

      const workflowList: WorkflowListResponse = data as WorkflowListResponse;

      this.logger.debug(
        `Successfully fetched ${workflowList.data.items.length} workflows for org: ${orgName}`,
      );
      return workflowList;
    } catch (error) {
      this.logger.error(
        `Failed to fetch workflows for org ${orgName}: ${error}`,
      );
      throw error;
    }
  }

  /**
   * Fetch JSONSchema for a specific workflow
   */
  async fetchWorkflowSchema(
    orgName: string,
    workflowName: string,
  ): Promise<WorkflowSchemaResponse> {
    this.logger.debug(
      `Fetching schema for workflow: ${workflowName} in org: ${orgName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/orgs/{orgName}/workflows/{workflowName}/schema',
        {
          params: {
            path: { orgName, workflowName },
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch workflow schema: ${response.status} ${response.statusText}`,
        );
      }

      if (!data?.success) {
        throw new Error('Failed to fetch workflow schema');
      }

      const workflowSchema: WorkflowSchemaResponse =
        data as WorkflowSchemaResponse;

      this.logger.debug(
        `Successfully fetched schema for workflow: ${workflowName}`,
      );
      return workflowSchema;
    } catch (error) {
      this.logger.error(
        `Failed to fetch schema for workflow ${workflowName} in org ${orgName}: ${error}`,
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
    schema: { [key: string]: unknown },
  ): Promise<OpenChoreoComponents['schemas']['APIResponse']> {
    this.logger.debug(
      `Updating workflow schema for component: ${componentName} in project: ${projectName}, org: ${orgName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        logger: this.logger,
      });

      const { data, error, response } = await client.PATCH(
        '/orgs/{orgName}/projects/{projectName}/components/{componentName}/workflow-schema',
        {
          params: {
            path: { orgName, projectName, componentName },
          },
          body: { schema },
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
