import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  assertApiResponse,
  fetchAllPages,
} from '@openchoreo/openchoreo-client-node';
import type {
  ClusterHookResponse,
  HookResponse,
} from '@openchoreo/backstage-plugin-common';
import { transformHook, transformClusterHook } from '../transformers/hook';
import type { ApiItemResponse, ApiListResponse } from '../types';

type HookListResponse = ApiListResponse<HookResponse>;
type ClusterHookListResponse = ApiListResponse<ClusterHookResponse>;

/**
 * Read access to deployment hooks (alpha): namespaced `Hook` and cluster-scoped
 * `ClusterHook`. Create/update/delete go through PlatformResourceService and the
 * scaffolder actions, as for traits.
 */
export class HookInfoService {
  private logger: LoggerService;
  private baseUrl: string;

  constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
  }

  private client(token?: string) {
    return createOpenChoreoApiClient({
      baseUrl: this.baseUrl,
      token,
      logger: this.logger,
    });
  }

  async listHooks(
    namespaceName: string,
    token?: string,
  ): Promise<HookListResponse> {
    this.logger.debug(`Fetching hooks for namespace: ${namespaceName}`);
    try {
      const client = this.client(token);
      const hooks = await fetchAllPages(cursor =>
        client
          .GET('/api/v1/namespaces/{namespaceName}/hooks', {
            params: {
              path: { namespaceName },
              query: { limit: 100, cursor },
            },
          })
          .then(res => {
            assertApiResponse(res, 'fetch hooks');
            return res.data;
          }),
      );
      const items = hooks.map(transformHook);
      this.logger.debug(`Successfully fetched ${items.length} hooks`);
      return {
        success: true,
        data: { items, totalCount: items.length },
      } as HookListResponse;
    } catch (error) {
      this.logger.error(`Failed to fetch hooks: ${error}`);
      throw error;
    }
  }

  async getHook(
    namespaceName: string,
    hookName: string,
    token?: string,
  ): Promise<ApiItemResponse<HookResponse>> {
    this.logger.debug(`Fetching hook ${namespaceName}/${hookName}`);
    try {
      const client = this.client(token);
      const { data, error, response } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/hooks/{hookName}',
        { params: { path: { namespaceName, hookName } } },
      );
      assertApiResponse({ data, error, response }, 'fetch hook');
      return { success: true, data: transformHook(data!) };
    } catch (error) {
      this.logger.error(`Failed to fetch hook ${hookName}: ${error}`);
      throw error;
    }
  }

  async listClusterHooks(token?: string): Promise<ClusterHookListResponse> {
    this.logger.debug('Fetching cluster hooks');
    try {
      const client = this.client(token);
      const hooks = await fetchAllPages(cursor =>
        client
          .GET('/api/v1/clusterhooks', {
            params: { query: { limit: 100, cursor } },
          })
          .then(res => {
            assertApiResponse(res, 'fetch cluster hooks');
            return res.data;
          }),
      );
      const items = hooks.map(transformClusterHook);
      this.logger.debug(`Successfully fetched ${items.length} cluster hooks`);
      return {
        success: true,
        data: { items, totalCount: items.length },
      } as ClusterHookListResponse;
    } catch (error) {
      this.logger.error(`Failed to fetch cluster hooks: ${error}`);
      throw error;
    }
  }

  async getClusterHook(
    clusterHookName: string,
    token?: string,
  ): Promise<ApiItemResponse<ClusterHookResponse>> {
    this.logger.debug(`Fetching cluster hook ${clusterHookName}`);
    try {
      const client = this.client(token);
      const { data, error, response } = await client.GET(
        '/api/v1/clusterhooks/{clusterHookName}',
        { params: { path: { clusterHookName } } },
      );
      assertApiResponse({ data, error, response }, 'fetch cluster hook');
      return { success: true, data: transformClusterHook(data!) };
    } catch (error) {
      this.logger.error(
        `Failed to fetch cluster hook ${clusterHookName}: ${error}`,
      );
      throw error;
    }
  }
}
