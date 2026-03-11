import { LoggerService } from '@backstage/backend-plugin-api';
import { WorkloadService } from '../../types';
import {
  createOpenChoreoApiClient,
  assertApiResponse,
} from '@openchoreo/openchoreo-client-node';
import type { WorkloadResource } from '@openchoreo/backstage-plugin-common';

export class WorkloadInfoService implements WorkloadService {
  private readonly logger: LoggerService;
  private readonly baseUrl: string;

  public constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
  }

  static create(logger: LoggerService, baseUrl: string): WorkloadInfoService {
    return new WorkloadInfoService(logger, baseUrl);
  }

  async fetchWorkloadInfo(
    request: {
      projectName: string;
      componentName: string;
      namespaceName: string;
    },
    token?: string,
  ): Promise<WorkloadResource | null> {
    const { projectName, componentName, namespaceName } = request;

    try {
      this.logger.info(
        `Fetching workload info for component: ${componentName} in namespace: ${namespaceName}`,
      );

      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      // List workloads filtered by project and component name
      const { data, error, response } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/workloads',
        {
          params: {
            path: { namespaceName },
            query: { project: projectName, component: componentName },
          },
        },
      );

      assertApiResponse({ data, error, response }, 'fetch workloads');

      const workload = data!.items[0];
      if (!workload) {
        this.logger.debug(`No workload found for component ${componentName}`);
        return null;
      }

      // Return the full K8s workload resource as-is
      return workload as WorkloadResource;
    } catch (error) {
      this.logger.error(`Failed to fetch workload info: ${error}`);
      throw error;
    }
  }

  async applyWorkload(
    request: {
      projectName: string;
      componentName: string;
      namespaceName: string;
      workload: WorkloadResource;
      isNew: boolean;
    },
    token?: string,
  ): Promise<WorkloadResource> {
    const { projectName, componentName, namespaceName, workload, isNew } =
      request;

    try {
      this.logger.info(
        `${
          isNew ? 'Creating' : 'Updating'
        } workload for component: ${componentName} in namespace: ${namespaceName}`,
      );

      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      if (!isNew) {
        // Update existing workload — use the resource name as the path param
        const workloadName = workload.metadata?.name;
        if (!workloadName) {
          throw new Error(
            'Workload metadata.name is required for updating an existing workload',
          );
        }

        const { data, error, response } = await client.PUT(
          '/api/v1/namespaces/{namespaceName}/workloads/{workloadName}',
          {
            params: {
              path: { namespaceName, workloadName },
            },
            body: workload as any,
          },
        );

        assertApiResponse({ data, error, response }, 'update workload');

        return data! as WorkloadResource;
      }

      // Create new workload
      const newWorkload = {
        ...workload,
        metadata: {
          ...workload.metadata,
          name: workload.metadata?.name || `${componentName}-workload`,
        },
        spec: {
          ...(workload.spec as { [key: string]: unknown }),
          owner: {
            projectName,
            componentName,
          },
        },
      };

      const { data, error, response } = await client.POST(
        '/api/v1/namespaces/{namespaceName}/workloads',
        {
          params: {
            path: { namespaceName },
          },
          body: newWorkload as any,
        },
      );

      assertApiResponse({ data, error, response }, 'create workload');

      return data! as WorkloadResource;
    } catch (error) {
      this.logger.error(`Failed to apply workload: ${error}`);
      throw error;
    }
  }
}
