import { LoggerService } from '@backstage/backend-plugin-api';
import { WorkloadService } from '../../types';
import {
  createOpenChoreoLegacyApiClient,
  createOpenChoreoApiClient,
  type OpenChoreoLegacyComponents,
} from '@openchoreo/openchoreo-client-node';

// Use generated type from OpenAPI spec
type ModelsWorkload = OpenChoreoLegacyComponents['schemas']['WorkloadResponse'];

export class WorkloadInfoService implements WorkloadService {
  private readonly logger: LoggerService;
  private readonly baseUrl: string;
  private readonly useNewApi: boolean;

  public constructor(
    logger: LoggerService,
    baseUrl: string,
    useNewApi = false,
  ) {
    this.logger = logger;
    this.baseUrl = baseUrl;
    this.useNewApi = useNewApi;
  }

  static create(
    logger: LoggerService,
    baseUrl: string,
    useNewApi = false,
  ): WorkloadInfoService {
    return new WorkloadInfoService(logger, baseUrl, useNewApi);
  }

  async fetchWorkloadInfo(
    request: {
      projectName: string;
      componentName: string;
      namespaceName: string;
    },
    token?: string,
  ): Promise<ModelsWorkload> {
    if (this.useNewApi) {
      return this.fetchWorkloadInfoNew(request, token);
    }
    return this.fetchWorkloadInfoLegacy(request, token);
  }

  private async fetchWorkloadInfoLegacy(
    request: {
      projectName: string;
      componentName: string;
      namespaceName: string;
    },
    token?: string,
  ): Promise<ModelsWorkload> {
    const { projectName, componentName, namespaceName } = request;

    try {
      this.logger.info(
        `Fetching workload info for component: ${componentName} in project: ${projectName}, namespace: ${namespaceName}`,
      );

      const client = createOpenChoreoLegacyApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.GET(
        '/namespaces/{namespaceName}/projects/{projectName}/components/{componentName}/workloads',
        {
          params: {
            path: {
              namespaceName,
              projectName,
              componentName,
            },
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch workload: ${response.status} ${response.statusText}`,
        );
      }

      if (!data.success || !data.data) {
        throw new Error('No workload data returned');
      }

      return data.data;
    } catch (error) {
      this.logger.error(`Failed to fetch workload info: ${error}`);
      throw new Error('Failed to fetch workload info', { cause: error });
    }
  }

  private async fetchWorkloadInfoNew(
    request: {
      projectName: string;
      componentName: string;
      namespaceName: string;
    },
    token?: string,
  ): Promise<ModelsWorkload> {
    const { componentName, namespaceName } = request;

    try {
      this.logger.info(
        `Fetching workload info (new API) for component: ${componentName} in namespace: ${namespaceName}`,
      );

      const client = createOpenChoreoApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      // List workloads filtered by component name
      const { data, error, response } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/workloads',
        {
          params: {
            path: { namespaceName },
            query: { component: componentName },
          },
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to fetch workloads: ${response.status} ${response.statusText}`,
        );
      }

      const workload = data.items[0];
      if (!workload) {
        throw new Error('No workload data returned');
      }

      // Return the spec directly — the spec object contains the same
      // flexible structure the frontend expects
      return workload.spec as ModelsWorkload;
    } catch (error) {
      this.logger.error(`Failed to fetch workload info: ${error}`);
      throw new Error('Failed to fetch workload info', { cause: error });
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
    if (this.useNewApi) {
      return this.applyWorkloadNew(request, token);
    }
    return this.applyWorkloadLegacy(request, token);
  }

  private async applyWorkloadLegacy(
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
        `Applying workload for component: ${componentName} in project: ${projectName}, namespace: ${namespaceName}`,
      );

      const client = createOpenChoreoLegacyApiClient({
        baseUrl: this.baseUrl,
        token,
        logger: this.logger,
      });

      const { data, error, response } = await client.POST(
        '/namespaces/{namespaceName}/projects/{projectName}/components/{componentName}/workloads',
        {
          params: {
            path: {
              namespaceName,
              projectName,
              componentName,
            },
          },
          body: workloadSpec,
        },
      );

      if (error || !response.ok) {
        throw new Error(
          `Failed to update workload: ${response.status} ${response.statusText}`,
        );
      }

      if (!data.success || !data.data) {
        throw new Error('No workload data returned');
      }

      return data.data;
    } catch (error) {
      this.logger.error(`Failed to apply workload: ${error}`);
      throw error;
    }
  }

  private async applyWorkloadNew(
    request: {
      projectName: string;
      componentName: string;
      namespaceName: string;
      workloadSpec: ModelsWorkload;
    },
    token?: string,
  ): Promise<any> {
    const { componentName, namespaceName, workloadSpec } = request;

    try {
      this.logger.info(
        `Applying workload (new API) for component: ${componentName} in namespace: ${namespaceName}`,
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
          query: { component: componentName },
        },
      });

      if (listError || !listResponse.ok) {
        throw new Error(
          `Failed to list workloads: ${listResponse.status} ${listResponse.statusText}`,
        );
      }

      const existingWorkload = listData.items[0];
      if (!existingWorkload) {
        throw new Error(
          `No existing workload found for component: ${componentName}`,
        );
      }

      const workloadName = existingWorkload.metadata.name;
      if (!workloadName) {
        throw new Error(
          `Workload for component ${componentName} has no name in metadata`,
        );
      }

      // Update the workload with the new spec
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

      if (error || !response.ok) {
        throw new Error(
          `Failed to update workload: ${response.status} ${response.statusText}`,
        );
      }

      return data.spec;
    } catch (error) {
      this.logger.error(`Failed to apply workload: ${error}`);
      throw error;
    }
  }
}
