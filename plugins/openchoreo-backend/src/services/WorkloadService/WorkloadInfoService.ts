import { LoggerService } from '@backstage/backend-plugin-api';
import { WorkloadService } from '../../types';
import {
  createOpenChoreoApiClient,
  assertApiResponse,
} from '@openchoreo/openchoreo-client-node';
import type {
  WorkloadResponse,
  WorkloadWithRaw,
} from '@openchoreo/backstage-plugin-common';

type ModelsWorkload = WorkloadResponse;

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
  ): Promise<WorkloadWithRaw | null> {
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

      // Return spec fields spread at top level (for form editing)
      // plus the full K8s resource as _raw (for YAML display)
      return {
        ...(workload.spec as ModelsWorkload),
        _raw: workload,
      } as WorkloadWithRaw;
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
      workloadSpec: ModelsWorkload;
    },
    token?: string,
  ): Promise<any> {
    const { projectName, componentName, namespaceName, workloadSpec } = request;

    try {
      this.logger.info(
        `Applying workload for component: ${componentName} in namespace: ${namespaceName}`,
      );

      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      // First find the existing workload for this component
      const {
        data: listData,
        error: listError,
        response: listResponse,
      } = await client.GET('/api/v1/namespaces/{namespaceName}/workloads', {
        params: {
          path: { namespaceName },
          query: { project: projectName, component: componentName },
        },
      });

      assertApiResponse(
        { data: listData, error: listError, response: listResponse },
        'list workloads',
      );

      const existingWorkload = listData!.items[0];

      if (existingWorkload) {
        // Update existing workload
        const workloadName = existingWorkload.metadata.name;
        if (!workloadName) {
          throw new Error(
            `Workload for component ${componentName} has no name in metadata`,
          );
        }

        const { data, error, response } = await client.PUT(
          '/api/v1/namespaces/{namespaceName}/workloads/{workloadName}',
          {
            params: {
              path: { namespaceName, workloadName },
            },
            body: {
              ...existingWorkload,
              spec: workloadSpec as { [key: string]: unknown },
            },
          },
        );

        assertApiResponse({ data, error, response }, 'update workload');

        return data!.spec;
      }

      // Create new workload
      const { data, error, response } = await client.POST(
        '/api/v1/namespaces/{namespaceName}/workloads',
        {
          params: {
            path: { namespaceName },
          },
          body: {
            metadata: {
              name: `${componentName}-workload`,
            },
            spec: {
              ...(workloadSpec as { [key: string]: unknown }),
              owner: {
                projectName,
                componentName,
              },
            },
          },
        },
      );

      assertApiResponse({ data, error, response }, 'create workload');

      return data!.spec;
    } catch (error) {
      this.logger.error(`Failed to apply workload: ${error}`);
      throw error;
    }
  }
}
