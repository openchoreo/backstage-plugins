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

      const { data, error, response } = await client.GET(
        '/orgs/{orgName}/component-workflows',
        {
          params: {
            path: { orgName },
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch component workflows: ${response.status} ${response.statusText}`,
        );
      }

      if (!data?.success) {
        throw new Error('Failed to fetch component workflows');
      }

      const workflowList: WorkflowListResponse = data as WorkflowListResponse;

      this.logger.debug(
        `Successfully fetched ${workflowList.data.items.length} component workflows for org: ${orgName}`,
      );
      return workflowList;
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
   * Update component workflow parameters (PATCH)
   */
  async updateComponentWorkflowParameters(
    orgName: string,
    projectName: string,
    componentName: string,
    systemParameters: { [key: string]: unknown },
    parameters?: { [key: string]: unknown },
    token?: string,
  ): Promise<OpenChoreoComponents['schemas']['APIResponse']> {
    this.logger.debug(
      `Updating workflow parameters for component: ${componentName} in project: ${projectName}, org: ${orgName}`,
    );

    try {
      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.PATCH(
        '/orgs/{orgName}/projects/{projectName}/components/{componentName}/workflow-parameters',
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
          `Failed to update workflow parameters: ${response.status} ${response.statusText}`,
        );
      }

      if (!data?.success) {
        throw new Error('Failed to update workflow parameters');
      }

      this.logger.debug(
        `Successfully updated workflow parameters for component: ${componentName}`,
      );
      return data;
    } catch (error) {
      this.logger.error(
        `Failed to update workflow parameters for component ${componentName}: ${error}`,
      );
      throw error;
    }
  }
}
