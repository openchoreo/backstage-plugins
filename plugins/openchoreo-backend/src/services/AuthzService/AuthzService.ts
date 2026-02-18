import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoLegacyApiClient,
  createOpenChoreoApiClient,
  fetchAllPages,
  type OpenChoreoLegacyComponents,
} from '@openchoreo/openchoreo-client-node';

// Type definitions from the OpenAPI spec
export type Entitlement = OpenChoreoLegacyComponents['schemas']['Entitlement'];
export type UserTypeConfig =
  OpenChoreoLegacyComponents['schemas']['UserTypeConfig'];

// Response types
type ActionsListResponse =
  OpenChoreoLegacyComponents['schemas']['APIResponse'] & {
    data?: string[];
  };

type UserTypesListResponse =
  OpenChoreoLegacyComponents['schemas']['APIResponse'] & {
    data?: UserTypeConfig[];
  };

// Helper to extract error message from API response
function extractErrorMessage(
  error: unknown,
  response: Response,
  defaultMsg: string,
): string {
  // Try to get message from error object (openapi-fetch error response)
  if (error && typeof error === 'object') {
    const errObj = error as Record<string, unknown>;
    if (errObj.message && typeof errObj.message === 'string') {
      return errObj.message;
    }
    // Check for nested error structure
    if (errObj.error && typeof errObj.error === 'object') {
      const nestedErr = errObj.error as Record<string, unknown>;
      if (nestedErr.message && typeof nestedErr.message === 'string') {
        return nestedErr.message;
      }
    }
  }
  return `${defaultMsg}: ${response.status} ${response.statusText}`;
}

export class AuthzService {
  private readonly logger: LoggerService;
  private readonly baseUrl: string;
  private readonly useNewApi: boolean;

  constructor(logger: LoggerService, baseUrl: string, useNewApi = false) {
    this.logger = logger;
    this.baseUrl = baseUrl;
    this.useNewApi = useNewApi;
  }

  private createClient(token?: string) {
    return createOpenChoreoLegacyApiClient({
      baseUrl: this.baseUrl,
      token,
      logger: this.logger,
    });
  }

  private createNewClient(token?: string) {
    return createOpenChoreoApiClient({
      baseUrl: this.baseUrl,
      token,
      logger: this.logger,
    });
  }

  // =====================
  // Actions
  // =====================

  async listActions(userToken?: string): Promise<{ data: string[] }> {
    if (this.useNewApi) {
      return this.listActionsNew(userToken);
    }
    return this.listActionsLegacy(userToken);
  }

  private async listActionsLegacy(
    userToken?: string,
  ): Promise<{ data: string[] }> {
    this.logger.debug('Fetching all available actions');

    try {
      const client = this.createClient(userToken);
      const { data, error, response } = await client.GET('/authz/actions');

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to fetch actions',
        );
        throw new Error(errorMsg);
      }

      const actionsResponse = data as ActionsListResponse;
      this.logger.debug(
        `Successfully fetched ${actionsResponse.data?.length || 0} actions`,
      );

      return { data: actionsResponse.data || [] };
    } catch (err) {
      this.logger.error(`Failed to fetch actions: ${err}`);
      throw err;
    }
  }

  private async listActionsNew(
    userToken?: string,
  ): Promise<{ data: string[] }> {
    this.logger.debug('Fetching all available actions (new API)');

    try {
      const client = this.createNewClient(userToken);
      const { data, error, response } = await client.GET(
        '/api/v1/authz/actions',
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to fetch actions',
        );
        throw new Error(errorMsg);
      }

      this.logger.debug(`Successfully fetched ${data?.length || 0} actions`);

      return { data: data || [] };
    } catch (err) {
      this.logger.error(`Failed to fetch actions: ${err}`);
      throw err;
    }
  }

  // =====================
  // User Types
  // =====================

  async listUserTypes(userToken?: string): Promise<{ data: UserTypeConfig[] }> {
    if (this.useNewApi) {
      return this.listUserTypesNew(userToken);
    }
    return this.listUserTypesLegacy(userToken);
  }

  private async listUserTypesLegacy(
    userToken?: string,
  ): Promise<{ data: UserTypeConfig[] }> {
    this.logger.debug('Fetching all user types');

    try {
      const client = this.createClient(userToken);
      const { data, error, response } = await client.GET('/user-types');

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to fetch user types',
        );
        throw new Error(errorMsg);
      }

      const userTypesResponse = data as UserTypesListResponse;
      this.logger.debug(
        `Successfully fetched ${
          userTypesResponse.data?.length || 0
        } user types`,
      );

      return { data: userTypesResponse.data || [] };
    } catch (err) {
      this.logger.error(`Failed to fetch user types: ${err}`);
      throw err;
    }
  }

  private async listUserTypesNew(
    userToken?: string,
  ): Promise<{ data: UserTypeConfig[] }> {
    this.logger.debug('Fetching all user types (new API)');

    try {
      const client = this.createNewClient(userToken);
      const { data, error, response } = await client.GET('/api/v1/user-types');

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to fetch user types',
        );
        throw new Error(errorMsg);
      }

      this.logger.debug(`Successfully fetched ${data?.length || 0} user types`);

      // New API returns UserTypeConfig[] directly, wrap for consistency
      return { data: (data || []) as UserTypeConfig[] };
    } catch (err) {
      this.logger.error(`Failed to fetch user types: ${err}`);
      throw err;
    }
  }

  // =====================
  // Hierarchy Data Methods (for Access Control autocomplete)
  // =====================

  // Namespaces
  async listNamespaces(
    userToken?: string,
  ): Promise<{ data: Array<{ name: string; displayName?: string }> }> {
    if (this.useNewApi) {
      return this.listNamespacesNew(userToken);
    }
    return this.listNamespacesLegacy(userToken);
  }

  private async listNamespacesLegacy(
    userToken?: string,
  ): Promise<{ data: Array<{ name: string; displayName?: string }> }> {
    this.logger.debug('Fetching all namespaces');

    try {
      const client = this.createClient(userToken);
      const { data, error, response } = await client.GET('/namespaces');

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to fetch namespaces',
        );
        throw new Error(errorMsg);
      }

      // OpenChoreo API returns { data: { items: [...] } }
      const nsResponse = data as {
        data?: { items?: Array<{ name: string }> };
      };
      const items = nsResponse.data?.items || [];
      this.logger.debug(`Successfully fetched ${items.length} namespaces`);

      return { data: items };
    } catch (err) {
      this.logger.error(`Failed to fetch namespaces: ${err}`);
      throw err;
    }
  }

  private async listNamespacesNew(
    userToken?: string,
  ): Promise<{ data: Array<{ name: string; displayName?: string }> }> {
    this.logger.debug('Fetching all namespaces (new API)');

    try {
      const client = this.createNewClient(userToken);
      const items = await fetchAllPages(cursor =>
        client
          .GET('/api/v1/namespaces', {
            params: { query: { limit: 100, cursor } },
          })
          .then(res => {
            if (res.error || !res.response.ok) {
              throw new Error(
                `Failed to fetch namespaces: ${res.response.status} ${res.response.statusText}`,
              );
            }
            return res.data;
          }),
      );

      this.logger.debug(`Successfully fetched ${items.length} namespaces`);

      return {
        data: items.map(ns => ({
          name: ns.name,
          displayName: ns.displayName,
        })),
      };
    } catch (err) {
      this.logger.error(`Failed to fetch namespaces: ${err}`);
      throw err;
    }
  }

  // Projects
  async listProjects(
    namespaceName: string,
    userToken?: string,
  ): Promise<{ data: Array<{ name: string; displayName?: string }> }> {
    if (this.useNewApi) {
      return this.listProjectsNew(namespaceName, userToken);
    }
    return this.listProjectsLegacy(namespaceName, userToken);
  }

  private async listProjectsLegacy(
    namespaceName: string,
    userToken?: string,
  ): Promise<{ data: Array<{ name: string; displayName?: string }> }> {
    this.logger.debug(`Fetching projects for namespace: ${namespaceName}`);

    try {
      const client = this.createClient(userToken);
      const { data, error, response } = await client.GET(
        '/namespaces/{namespaceName}/projects',
        {
          params: { path: { namespaceName } },
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to fetch projects',
        );
        throw new Error(errorMsg);
      }

      // OpenChoreo API returns { data: { items: [...] } }
      const projectsResponse = data as {
        data?: { items?: Array<{ name: string }> };
      };
      const items = projectsResponse.data?.items || [];
      this.logger.debug(
        `Successfully fetched ${items.length} projects for namespace ${namespaceName}`,
      );

      return { data: items };
    } catch (err) {
      this.logger.error(
        `Failed to fetch projects for namespace ${namespaceName}: ${err}`,
      );
      throw err;
    }
  }

  private async listProjectsNew(
    namespaceName: string,
    userToken?: string,
  ): Promise<{ data: Array<{ name: string; displayName?: string }> }> {
    this.logger.debug(
      `Fetching projects for namespace: ${namespaceName} (new API)`,
    );

    try {
      const client = this.createNewClient(userToken);
      const items = await fetchAllPages(cursor =>
        client
          .GET('/api/v1/namespaces/{namespaceName}/projects', {
            params: {
              path: { namespaceName },
              query: { limit: 100, cursor },
            },
          })
          .then(res => {
            if (res.error || !res.response.ok) {
              throw new Error(
                `Failed to fetch projects: ${res.response.status} ${res.response.statusText}`,
              );
            }
            return res.data;
          }),
      );

      this.logger.debug(
        `Successfully fetched ${items.length} projects for namespace ${namespaceName}`,
      );

      return {
        data: items.map(p => ({
          name: p.metadata?.name ?? '',
          displayName: p.metadata?.annotations?.['openchoreo.dev/display-name'],
        })),
      };
    } catch (err) {
      this.logger.error(
        `Failed to fetch projects for namespace ${namespaceName}: ${err}`,
      );
      throw err;
    }
  }

  // Components
  async listComponents(
    namespaceName: string,
    projectName: string,
    userToken?: string,
  ): Promise<{ data: Array<{ name: string; displayName?: string }> }> {
    if (this.useNewApi) {
      return this.listComponentsNew(namespaceName, projectName, userToken);
    }
    return this.listComponentsLegacy(namespaceName, projectName, userToken);
  }

  private async listComponentsLegacy(
    namespaceName: string,
    projectName: string,
    userToken?: string,
  ): Promise<{ data: Array<{ name: string; displayName?: string }> }> {
    this.logger.debug(
      `Fetching components for namespace: ${namespaceName}, project: ${projectName}`,
    );

    try {
      const client = this.createClient(userToken);
      const { data, error, response } = await client.GET(
        '/namespaces/{namespaceName}/projects/{projectName}/components',
        {
          params: { path: { namespaceName, projectName } },
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to fetch components',
        );
        throw new Error(errorMsg);
      }

      // OpenChoreo API returns { data: { items: [...] } }
      const componentsResponse = data as {
        data?: { items?: Array<{ name: string }> };
      };
      const items = componentsResponse.data?.items || [];
      this.logger.debug(
        `Successfully fetched ${items.length} components for ${namespaceName}/${projectName}`,
      );

      return { data: items };
    } catch (err) {
      this.logger.error(
        `Failed to fetch components for ${namespaceName}/${projectName}: ${err}`,
      );
      throw err;
    }
  }

  private async listComponentsNew(
    namespaceName: string,
    projectName: string,
    userToken?: string,
  ): Promise<{ data: Array<{ name: string; displayName?: string }> }> {
    this.logger.debug(
      `Fetching components for namespace: ${namespaceName}, project: ${projectName} (new API)`,
    );

    try {
      const client = this.createNewClient(userToken);
      const items = await fetchAllPages(cursor =>
        client
          .GET('/api/v1/namespaces/{namespaceName}/components', {
            params: {
              path: { namespaceName },
              query: { project: projectName, limit: 100, cursor },
            },
          })
          .then(res => {
            if (res.error || !res.response.ok) {
              throw new Error(
                `Failed to fetch components: ${res.response.status} ${res.response.statusText}`,
              );
            }
            return res.data;
          }),
      );

      this.logger.debug(
        `Successfully fetched ${items.length} components for ${namespaceName}/${projectName}`,
      );

      return {
        data: items.map(c => ({
          name: c.metadata?.name ?? '',
          displayName: c.metadata?.annotations?.['openchoreo.dev/display-name'],
        })),
      };
    } catch (err) {
      this.logger.error(
        `Failed to fetch components for ${namespaceName}/${projectName}: ${err}`,
      );
      throw err;
    }
  }

  // =====================
  // Cluster & Namespace Scoped Authorization Methods
  // =====================

  // Cluster Roles
  async listClusterRoles(userToken?: string): Promise<{
    data: Array<{ name: string; actions: string[]; description?: string }>;
  }> {
    if (this.useNewApi) {
      return this.listClusterRolesNew(userToken);
    }
    return this.listClusterRolesLegacy(userToken);
  }

  private async listClusterRolesLegacy(userToken?: string): Promise<{
    data: Array<{ name: string; actions: string[]; description?: string }>;
  }> {
    this.logger.debug('Fetching cluster roles');

    try {
      const client = this.createClient(userToken);
      const { data, error, response } = await client.GET('/clusterroles');

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to fetch cluster roles',
        );
        throw new Error(errorMsg);
      }

      const rolesResponse = data as { data?: Array<any> };
      this.logger.debug(
        `Successfully fetched ${rolesResponse.data?.length || 0} cluster roles`,
      );

      return { data: rolesResponse.data || [] };
    } catch (err) {
      this.logger.error(`Failed to fetch cluster roles: ${err}`);
      throw err;
    }
  }

  private async listClusterRolesNew(userToken?: string): Promise<{
    data: Array<{ name: string; actions: string[]; description?: string }>;
  }> {
    this.logger.debug('Fetching cluster roles (new API)');

    try {
      const client = this.createNewClient(userToken);
      const { data, error, response } = await client.GET(
        '/api/v1/clusterroles',
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to fetch cluster roles',
        );
        throw new Error(errorMsg);
      }

      this.logger.debug(
        `Successfully fetched ${data?.length || 0} cluster roles`,
      );

      return { data: data || [] };
    } catch (err) {
      this.logger.error(`Failed to fetch cluster roles: ${err}`);
      throw err;
    }
  }

  async getClusterRole(
    name: string,
    userToken?: string,
  ): Promise<{
    data: { name: string; actions: string[]; description?: string };
  }> {
    if (this.useNewApi) {
      return this.getClusterRoleNew(name, userToken);
    }
    return this.getClusterRoleLegacy(name, userToken);
  }

  private async getClusterRoleLegacy(
    name: string,
    userToken?: string,
  ): Promise<{
    data: { name: string; actions: string[]; description?: string };
  }> {
    this.logger.debug(`Fetching cluster role: ${name}`);

    try {
      const client = this.createClient(userToken);
      const { data, error, response } = await client.GET(
        '/clusterroles/{name}',
        {
          params: { path: { name } },
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to fetch cluster role',
        );
        throw new Error(errorMsg);
      }

      const roleResponse = data as { data: any };
      return { data: roleResponse.data };
    } catch (err) {
      this.logger.error(`Failed to fetch cluster role ${name}: ${err}`);
      throw err;
    }
  }

  private async getClusterRoleNew(
    name: string,
    userToken?: string,
  ): Promise<{
    data: { name: string; actions: string[]; description?: string };
  }> {
    this.logger.debug(`Fetching cluster role: ${name} (new API)`);

    try {
      const client = this.createNewClient(userToken);
      const { data, error, response } = await client.GET(
        '/api/v1/clusterroles/{name}',
        {
          params: { path: { name } },
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to fetch cluster role',
        );
        throw new Error(errorMsg);
      }

      return { data };
    } catch (err) {
      this.logger.error(`Failed to fetch cluster role ${name}: ${err}`);
      throw err;
    }
  }

  async createClusterRole(
    role: { name: string; actions: string[]; description?: string },
    userToken?: string,
  ): Promise<{ data: any }> {
    if (this.useNewApi) {
      return this.createClusterRoleNew(role, userToken);
    }
    return this.createClusterRoleLegacy(role, userToken);
  }

  private async createClusterRoleLegacy(
    role: { name: string; actions: string[]; description?: string },
    userToken?: string,
  ): Promise<{ data: any }> {
    this.logger.debug(`Creating cluster role: ${role.name}`);

    try {
      const client = this.createClient(userToken);
      const { data, error, response } = await client.POST('/clusterroles', {
        body: role,
      });

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to create cluster role',
        );
        throw new Error(errorMsg);
      }

      const roleResponse = data as { data: any };
      this.logger.debug(`Successfully created cluster role: ${role.name}`);
      return { data: roleResponse.data };
    } catch (err) {
      this.logger.error(`Failed to create cluster role ${role.name}: ${err}`);
      throw err;
    }
  }

  private async createClusterRoleNew(
    role: { name: string; actions: string[]; description?: string },
    userToken?: string,
  ): Promise<{ data: any }> {
    this.logger.debug(`Creating cluster role: ${role.name} (new API)`);

    try {
      const client = this.createNewClient(userToken);
      const { data, error, response } = await client.POST(
        '/api/v1/clusterroles',
        {
          body: role,
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to create cluster role',
        );
        throw new Error(errorMsg);
      }

      this.logger.debug(`Successfully created cluster role: ${role.name}`);
      return { data };
    } catch (err) {
      this.logger.error(`Failed to create cluster role ${role.name}: ${err}`);
      throw err;
    }
  }

  async updateClusterRole(
    name: string,
    role: { actions?: string[]; description?: string },
    userToken?: string,
  ): Promise<{ data: any }> {
    if (this.useNewApi) {
      return this.updateClusterRoleNew(name, role, userToken);
    }
    return this.updateClusterRoleLegacy(name, role, userToken);
  }

  private async updateClusterRoleLegacy(
    name: string,
    role: { actions?: string[]; description?: string },
    userToken?: string,
  ): Promise<{ data: any }> {
    this.logger.debug(`Updating cluster role: ${name}`);

    try {
      const client = this.createClient(userToken);
      const { data, error, response } = await client.PUT(
        '/clusterroles/{name}',
        {
          params: { path: { name } },
          body: role,
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to update cluster role',
        );
        throw new Error(errorMsg);
      }

      const roleResponse = data as { data: any };
      this.logger.debug(`Successfully updated cluster role: ${name}`);
      return { data: roleResponse.data };
    } catch (err) {
      this.logger.error(`Failed to update cluster role ${name}: ${err}`);
      throw err;
    }
  }

  private async updateClusterRoleNew(
    name: string,
    role: { actions?: string[]; description?: string },
    userToken?: string,
  ): Promise<{ data: any }> {
    this.logger.debug(`Updating cluster role: ${name} (new API)`);

    try {
      const client = this.createNewClient(userToken);
      const { data, error, response } = await client.PUT(
        '/api/v1/clusterroles/{name}',
        {
          params: { path: { name } },
          body: role as { actions: string[]; description?: string },
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to update cluster role',
        );
        throw new Error(errorMsg);
      }

      this.logger.debug(`Successfully updated cluster role: ${name}`);
      return { data };
    } catch (err) {
      this.logger.error(`Failed to update cluster role ${name}: ${err}`);
      throw err;
    }
  }

  async deleteClusterRole(name: string, userToken?: string): Promise<void> {
    if (this.useNewApi) {
      return this.deleteClusterRoleNew(name, userToken);
    }
    return this.deleteClusterRoleLegacy(name, userToken);
  }

  private async deleteClusterRoleLegacy(
    name: string,
    userToken?: string,
  ): Promise<void> {
    this.logger.debug(`Deleting cluster role: ${name}`);

    try {
      const client = this.createClient(userToken);
      const { error, response } = await client.DELETE('/clusterroles/{name}', {
        params: { path: { name } },
      });

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to delete cluster role',
        );
        throw new Error(errorMsg);
      }

      this.logger.debug(`Successfully deleted cluster role: ${name}`);
    } catch (err) {
      this.logger.error(`Failed to delete cluster role ${name}: ${err}`);
      throw err;
    }
  }

  private async deleteClusterRoleNew(
    name: string,
    userToken?: string,
  ): Promise<void> {
    this.logger.debug(`Deleting cluster role: ${name} (new API)`);

    try {
      const client = this.createNewClient(userToken);
      const { error, response } = await client.DELETE(
        '/api/v1/clusterroles/{name}',
        {
          params: { path: { name } },
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to delete cluster role',
        );
        throw new Error(errorMsg);
      }

      this.logger.debug(`Successfully deleted cluster role: ${name}`);
    } catch (err) {
      this.logger.error(`Failed to delete cluster role ${name}: ${err}`);
      throw err;
    }
  }

  // =====================
  // Namespace Roles
  // =====================

  async listNamespaceRoles(
    namespace: string,
    userToken?: string,
  ): Promise<{ data: Array<any> }> {
    if (this.useNewApi) {
      return this.listNamespaceRolesNew(namespace, userToken);
    }
    return this.listNamespaceRolesLegacy(namespace, userToken);
  }

  private async listNamespaceRolesLegacy(
    namespace: string,
    userToken?: string,
  ): Promise<{ data: Array<any> }> {
    this.logger.debug(`Fetching namespace roles for: ${namespace}`);

    try {
      const client = this.createClient(userToken);
      const { data, error, response } = await client.GET(
        '/namespaces/{namespace}/roles',
        {
          params: { path: { namespace } },
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to fetch namespace roles',
        );
        throw new Error(errorMsg);
      }

      const rolesResponse = data as { data?: Array<any> };
      this.logger.debug(
        `Successfully fetched ${
          rolesResponse.data?.length || 0
        } namespace roles`,
      );

      return { data: rolesResponse.data || [] };
    } catch (err) {
      this.logger.error(`Failed to fetch namespace roles: ${err}`);
      throw err;
    }
  }

  private async listNamespaceRolesNew(
    namespace: string,
    userToken?: string,
  ): Promise<{ data: Array<any> }> {
    this.logger.debug(`Fetching namespace roles for: ${namespace} (new API)`);

    try {
      const client = this.createNewClient(userToken);
      const { data, error, response } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/roles',
        {
          params: { path: { namespaceName: namespace } },
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to fetch namespace roles',
        );
        throw new Error(errorMsg);
      }

      this.logger.debug(
        `Successfully fetched ${data?.length || 0} namespace roles`,
      );

      return { data: data || [] };
    } catch (err) {
      this.logger.error(`Failed to fetch namespace roles: ${err}`);
      throw err;
    }
  }

  async getNamespaceRole(
    namespace: string,
    name: string,
    userToken?: string,
  ): Promise<{ data: any }> {
    if (this.useNewApi) {
      return this.getNamespaceRoleNew(namespace, name, userToken);
    }
    return this.getNamespaceRoleLegacy(namespace, name, userToken);
  }

  private async getNamespaceRoleLegacy(
    namespace: string,
    name: string,
    userToken?: string,
  ): Promise<{ data: any }> {
    this.logger.debug(`Fetching namespace role: ${namespace}/${name}`);

    try {
      const client = this.createClient(userToken);
      const { data, error, response } = await client.GET(
        '/namespaces/{namespace}/roles/{name}',
        {
          params: { path: { namespace, name } },
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to fetch namespace role',
        );
        throw new Error(errorMsg);
      }

      const roleResponse = data as { data: any };
      return { data: roleResponse.data };
    } catch (err) {
      this.logger.error(
        `Failed to fetch namespace role ${namespace}/${name}: ${err}`,
      );
      throw err;
    }
  }

  private async getNamespaceRoleNew(
    namespace: string,
    name: string,
    userToken?: string,
  ): Promise<{ data: any }> {
    this.logger.debug(
      `Fetching namespace role: ${namespace}/${name} (new API)`,
    );

    try {
      const client = this.createNewClient(userToken);
      const { data, error, response } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/roles/{name}',
        {
          params: { path: { namespaceName: namespace, name } },
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to fetch namespace role',
        );
        throw new Error(errorMsg);
      }

      return { data };
    } catch (err) {
      this.logger.error(
        `Failed to fetch namespace role ${namespace}/${name}: ${err}`,
      );
      throw err;
    }
  }

  async createNamespaceRole(
    role: {
      name: string;
      namespace: string;
      actions: string[];
      description?: string;
    },
    userToken?: string,
  ): Promise<{ data: any }> {
    if (this.useNewApi) {
      return this.createNamespaceRoleNew(role, userToken);
    }
    return this.createNamespaceRoleLegacy(role, userToken);
  }

  private async createNamespaceRoleLegacy(
    role: {
      name: string;
      namespace: string;
      actions: string[];
      description?: string;
    },
    userToken?: string,
  ): Promise<{ data: any }> {
    this.logger.debug(
      `Creating namespace role: ${role.namespace}/${role.name}`,
    );

    try {
      const client = this.createClient(userToken);
      const { data, error, response } = await client.POST(
        '/namespaces/{namespace}/roles',
        {
          params: { path: { namespace: role.namespace } },
          body: role,
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to create namespace role',
        );
        throw new Error(errorMsg);
      }

      const roleResponse = data as { data: any };
      this.logger.debug(
        `Successfully created namespace role: ${role.namespace}/${role.name}`,
      );
      return { data: roleResponse.data };
    } catch (err) {
      this.logger.error(
        `Failed to create namespace role ${role.namespace}/${role.name}: ${err}`,
      );
      throw err;
    }
  }

  private async createNamespaceRoleNew(
    role: {
      name: string;
      namespace: string;
      actions: string[];
      description?: string;
    },
    userToken?: string,
  ): Promise<{ data: any }> {
    this.logger.debug(
      `Creating namespace role: ${role.namespace}/${role.name} (new API)`,
    );

    try {
      const client = this.createNewClient(userToken);
      const { data, error, response } = await client.POST(
        '/api/v1/namespaces/{namespaceName}/roles',
        {
          params: { path: { namespaceName: role.namespace } },
          body: {
            name: role.name,
            actions: role.actions,
            description: role.description,
          },
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to create namespace role',
        );
        throw new Error(errorMsg);
      }

      this.logger.debug(
        `Successfully created namespace role: ${role.namespace}/${role.name}`,
      );
      return { data };
    } catch (err) {
      this.logger.error(
        `Failed to create namespace role ${role.namespace}/${role.name}: ${err}`,
      );
      throw err;
    }
  }

  async updateNamespaceRole(
    namespace: string,
    name: string,
    role: { actions?: string[]; description?: string },
    userToken?: string,
  ): Promise<{ data: any }> {
    if (this.useNewApi) {
      return this.updateNamespaceRoleNew(namespace, name, role, userToken);
    }
    return this.updateNamespaceRoleLegacy(namespace, name, role, userToken);
  }

  private async updateNamespaceRoleLegacy(
    namespace: string,
    name: string,
    role: { actions?: string[]; description?: string },
    userToken?: string,
  ): Promise<{ data: any }> {
    this.logger.debug(`Updating namespace role: ${namespace}/${name}`);

    try {
      const client = this.createClient(userToken);
      const { data, error, response } = await client.PUT(
        '/namespaces/{namespace}/roles/{name}',
        {
          params: { path: { namespace, name } },
          body: role,
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to update namespace role',
        );
        throw new Error(errorMsg);
      }

      const roleResponse = data as { data: any };
      this.logger.debug(
        `Successfully updated namespace role: ${namespace}/${name}`,
      );
      return { data: roleResponse.data };
    } catch (err) {
      this.logger.error(
        `Failed to update namespace role ${namespace}/${name}: ${err}`,
      );
      throw err;
    }
  }

  private async updateNamespaceRoleNew(
    namespace: string,
    name: string,
    role: { actions?: string[]; description?: string },
    userToken?: string,
  ): Promise<{ data: any }> {
    this.logger.debug(
      `Updating namespace role: ${namespace}/${name} (new API)`,
    );

    try {
      const client = this.createNewClient(userToken);
      const { data, error, response } = await client.PUT(
        '/api/v1/namespaces/{namespaceName}/roles/{name}',
        {
          params: { path: { namespaceName: namespace, name } },
          body: role as { actions: string[]; description?: string },
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to update namespace role',
        );
        throw new Error(errorMsg);
      }

      this.logger.debug(
        `Successfully updated namespace role: ${namespace}/${name}`,
      );
      return { data };
    } catch (err) {
      this.logger.error(
        `Failed to update namespace role ${namespace}/${name}: ${err}`,
      );
      throw err;
    }
  }

  async deleteNamespaceRole(
    namespace: string,
    name: string,
    userToken?: string,
  ): Promise<void> {
    if (this.useNewApi) {
      return this.deleteNamespaceRoleNew(namespace, name, userToken);
    }
    return this.deleteNamespaceRoleLegacy(namespace, name, userToken);
  }

  private async deleteNamespaceRoleLegacy(
    namespace: string,
    name: string,
    userToken?: string,
  ): Promise<void> {
    this.logger.debug(`Deleting namespace role: ${namespace}/${name}`);

    try {
      const client = this.createClient(userToken);
      const { error, response } = await client.DELETE(
        '/namespaces/{namespace}/roles/{name}',
        {
          params: { path: { namespace, name } },
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to delete namespace role',
        );
        throw new Error(errorMsg);
      }

      this.logger.debug(
        `Successfully deleted namespace role: ${namespace}/${name}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to delete namespace role ${namespace}/${name}: ${err}`,
      );
      throw err;
    }
  }

  private async deleteNamespaceRoleNew(
    namespace: string,
    name: string,
    userToken?: string,
  ): Promise<void> {
    this.logger.debug(
      `Deleting namespace role: ${namespace}/${name} (new API)`,
    );

    try {
      const client = this.createNewClient(userToken);
      const { error, response } = await client.DELETE(
        '/api/v1/namespaces/{namespaceName}/roles/{name}',
        {
          params: { path: { namespaceName: namespace, name } },
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to delete namespace role',
        );
        throw new Error(errorMsg);
      }

      this.logger.debug(
        `Successfully deleted namespace role: ${namespace}/${name}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to delete namespace role ${namespace}/${name}: ${err}`,
      );
      throw err;
    }
  }

  // =====================
  // Cluster Role Bindings
  // =====================

  async listClusterRoleBindings(
    filters?: {
      roleName?: string;
      claim?: string;
      value?: string;
      effect?: string;
    },
    userToken?: string,
  ): Promise<{ data: Array<any> }> {
    if (this.useNewApi) {
      return this.listClusterRoleBindingsNew(filters, userToken);
    }
    return this.listClusterRoleBindingsLegacy(filters, userToken);
  }

  private async listClusterRoleBindingsLegacy(
    filters?: {
      roleName?: string;
      claim?: string;
      value?: string;
      effect?: string;
    },
    userToken?: string,
  ): Promise<{ data: Array<any> }> {
    this.logger.debug('Fetching cluster role bindings', { filters });

    try {
      const client = this.createClient(userToken);
      const query: any = {};
      if (filters?.roleName) query.roleName = filters.roleName;
      if (filters?.claim) query.claim = filters.claim;
      if (filters?.value) query.value = filters.value;
      if (filters?.effect) query.effect = filters.effect;

      const { data, error, response } = await client.GET(
        '/clusterrolebindings',
        {
          params: { query },
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to fetch cluster role bindings',
        );
        throw new Error(errorMsg);
      }

      const bindingsResponse = data as { data?: Array<any> };
      this.logger.debug(
        `Successfully fetched ${
          bindingsResponse.data?.length || 0
        } cluster role bindings`,
      );

      return { data: bindingsResponse.data || [] };
    } catch (err) {
      this.logger.error(`Failed to fetch cluster role bindings: ${err}`);
      throw err;
    }
  }

  private async listClusterRoleBindingsNew(
    filters?: {
      roleName?: string;
      claim?: string;
      value?: string;
      effect?: string;
    },
    userToken?: string,
  ): Promise<{ data: Array<any> }> {
    this.logger.debug('Fetching cluster role bindings (new API)', { filters });

    try {
      const client = this.createNewClient(userToken);
      const query: Record<string, string | undefined> = {};
      if (filters?.roleName) query.roleName = filters.roleName;
      if (filters?.claim) query.claim = filters.claim;
      if (filters?.value) query.value = filters.value;
      if (filters?.effect) query.effect = filters.effect;

      const { data, error, response } = await client.GET(
        '/api/v1/clusterrolebindings',
        {
          params: {
            query: query as {
              roleName?: string;
              claim?: string;
              value?: string;
              effect?: 'allow' | 'deny';
            },
          },
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to fetch cluster role bindings',
        );
        throw new Error(errorMsg);
      }

      this.logger.debug(
        `Successfully fetched ${data?.length || 0} cluster role bindings`,
      );

      return { data: data || [] };
    } catch (err) {
      this.logger.error(`Failed to fetch cluster role bindings: ${err}`);
      throw err;
    }
  }

  async getClusterRoleBinding(
    name: string,
    userToken?: string,
  ): Promise<{ data: any }> {
    if (this.useNewApi) {
      return this.getClusterRoleBindingNew(name, userToken);
    }
    return this.getClusterRoleBindingLegacy(name, userToken);
  }

  private async getClusterRoleBindingLegacy(
    name: string,
    userToken?: string,
  ): Promise<{ data: any }> {
    this.logger.debug(`Fetching cluster role binding: ${name}`);

    try {
      const client = this.createClient(userToken);
      const { data, error, response } = await client.GET(
        '/clusterrolebindings/{name}',
        {
          params: { path: { name } },
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to fetch cluster role binding',
        );
        throw new Error(errorMsg);
      }

      const bindingResponse = data as { data: any };
      return { data: bindingResponse.data };
    } catch (err) {
      this.logger.error(`Failed to fetch cluster role binding ${name}: ${err}`);
      throw err;
    }
  }

  private async getClusterRoleBindingNew(
    name: string,
    userToken?: string,
  ): Promise<{ data: any }> {
    this.logger.debug(`Fetching cluster role binding: ${name} (new API)`);

    try {
      const client = this.createNewClient(userToken);
      const { data, error, response } = await client.GET(
        '/api/v1/clusterrolebindings/{name}',
        {
          params: { path: { name } },
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to fetch cluster role binding',
        );
        throw new Error(errorMsg);
      }

      return { data };
    } catch (err) {
      this.logger.error(`Failed to fetch cluster role binding ${name}: ${err}`);
      throw err;
    }
  }

  async createClusterRoleBinding(
    binding: any,
    userToken?: string,
  ): Promise<{ data: any }> {
    if (this.useNewApi) {
      return this.createClusterRoleBindingNew(binding, userToken);
    }
    return this.createClusterRoleBindingLegacy(binding, userToken);
  }

  private async createClusterRoleBindingLegacy(
    binding: any,
    userToken?: string,
  ): Promise<{ data: any }> {
    this.logger.debug(`Creating cluster role binding: ${binding.name}`);

    try {
      const client = this.createClient(userToken);
      const { data, error, response } = await client.POST(
        '/clusterrolebindings',
        {
          body: binding,
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to create cluster role binding',
        );
        throw new Error(errorMsg);
      }

      const bindingResponse = data as { data: any };
      this.logger.debug(
        `Successfully created cluster role binding: ${binding.name}`,
      );
      return { data: bindingResponse.data };
    } catch (err) {
      this.logger.error(`Failed to create cluster role binding: ${err}`);
      throw err;
    }
  }

  private async createClusterRoleBindingNew(
    binding: any,
    userToken?: string,
  ): Promise<{ data: any }> {
    this.logger.debug(
      `Creating cluster role binding: ${binding.name} (new API)`,
    );

    try {
      const client = this.createNewClient(userToken);
      const { data, error, response } = await client.POST(
        '/api/v1/clusterrolebindings',
        {
          body: binding,
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to create cluster role binding',
        );
        throw new Error(errorMsg);
      }

      this.logger.debug(
        `Successfully created cluster role binding: ${binding.name}`,
      );
      return { data };
    } catch (err) {
      this.logger.error(`Failed to create cluster role binding: ${err}`);
      throw err;
    }
  }

  async updateClusterRoleBinding(
    name: string,
    binding: any,
    userToken?: string,
  ): Promise<{ data: any }> {
    if (this.useNewApi) {
      return this.updateClusterRoleBindingNew(name, binding, userToken);
    }
    return this.updateClusterRoleBindingLegacy(name, binding, userToken);
  }

  private async updateClusterRoleBindingLegacy(
    name: string,
    binding: any,
    userToken?: string,
  ): Promise<{ data: any }> {
    this.logger.debug(`Updating cluster role binding: ${name}`);

    try {
      const client = this.createClient(userToken);
      const { data, error, response } = await client.PUT(
        '/clusterrolebindings/{name}',
        {
          params: { path: { name } },
          body: binding,
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to update cluster role binding',
        );
        throw new Error(errorMsg);
      }

      const bindingResponse = data as { data: any };
      this.logger.debug(`Successfully updated cluster role binding: ${name}`);
      return { data: bindingResponse.data };
    } catch (err) {
      this.logger.error(
        `Failed to update cluster role binding ${name}: ${err}`,
      );
      throw err;
    }
  }

  private async updateClusterRoleBindingNew(
    name: string,
    binding: any,
    userToken?: string,
  ): Promise<{ data: any }> {
    this.logger.debug(`Updating cluster role binding: ${name} (new API)`);

    try {
      const client = this.createNewClient(userToken);
      const { data, error, response } = await client.PUT(
        '/api/v1/clusterrolebindings/{name}',
        {
          params: { path: { name } },
          body: binding,
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to update cluster role binding',
        );
        throw new Error(errorMsg);
      }

      this.logger.debug(`Successfully updated cluster role binding: ${name}`);
      return { data };
    } catch (err) {
      this.logger.error(
        `Failed to update cluster role binding ${name}: ${err}`,
      );
      throw err;
    }
  }

  async deleteClusterRoleBinding(
    name: string,
    userToken?: string,
  ): Promise<void> {
    if (this.useNewApi) {
      return this.deleteClusterRoleBindingNew(name, userToken);
    }
    return this.deleteClusterRoleBindingLegacy(name, userToken);
  }

  private async deleteClusterRoleBindingLegacy(
    name: string,
    userToken?: string,
  ): Promise<void> {
    this.logger.debug(`Deleting cluster role binding: ${name}`);

    try {
      const client = this.createClient(userToken);
      const { error, response } = await client.DELETE(
        '/clusterrolebindings/{name}',
        {
          params: { path: { name } },
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to delete cluster role binding',
        );
        throw new Error(errorMsg);
      }

      this.logger.debug(`Successfully deleted cluster role binding: ${name}`);
    } catch (err) {
      this.logger.error(
        `Failed to delete cluster role binding ${name}: ${err}`,
      );
      throw err;
    }
  }

  private async deleteClusterRoleBindingNew(
    name: string,
    userToken?: string,
  ): Promise<void> {
    this.logger.debug(`Deleting cluster role binding: ${name} (new API)`);

    try {
      const client = this.createNewClient(userToken);
      const { error, response } = await client.DELETE(
        '/api/v1/clusterrolebindings/{name}',
        {
          params: { path: { name } },
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to delete cluster role binding',
        );
        throw new Error(errorMsg);
      }

      this.logger.debug(`Successfully deleted cluster role binding: ${name}`);
    } catch (err) {
      this.logger.error(
        `Failed to delete cluster role binding ${name}: ${err}`,
      );
      throw err;
    }
  }

  // =====================
  // Namespace Role Bindings
  // =====================

  async listNamespaceRoleBindings(
    namespace: string,
    filters?: {
      roleName?: string;
      roleNamespace?: string;
      claim?: string;
      value?: string;
      effect?: string;
    },
    userToken?: string,
  ): Promise<{ data: Array<any> }> {
    if (this.useNewApi) {
      return this.listNamespaceRoleBindingsNew(namespace, filters, userToken);
    }
    return this.listNamespaceRoleBindingsLegacy(namespace, filters, userToken);
  }

  private async listNamespaceRoleBindingsLegacy(
    namespace: string,
    filters?: {
      roleName?: string;
      roleNamespace?: string;
      claim?: string;
      value?: string;
      effect?: string;
    },
    userToken?: string,
  ): Promise<{ data: Array<any> }> {
    this.logger.debug(`Fetching namespace role bindings for: ${namespace}`, {
      filters,
    });

    try {
      const client = this.createClient(userToken);
      const query: any = {};
      if (filters?.roleName) query.roleName = filters.roleName;
      if (filters?.roleNamespace) query.roleNamespace = filters.roleNamespace;
      if (filters?.claim) query.claim = filters.claim;
      if (filters?.value) query.value = filters.value;
      if (filters?.effect) query.effect = filters.effect;

      const { data, error, response } = await client.GET(
        '/namespaces/{namespace}/rolebindings',
        {
          params: { path: { namespace }, query },
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to fetch namespace role bindings',
        );
        throw new Error(errorMsg);
      }

      const bindingsResponse = data as { data?: Array<any> };
      this.logger.debug(
        `Successfully fetched ${
          bindingsResponse.data?.length || 0
        } namespace role bindings`,
      );

      return { data: bindingsResponse.data || [] };
    } catch (err) {
      this.logger.error(`Failed to fetch namespace role bindings: ${err}`);
      throw err;
    }
  }

  private async listNamespaceRoleBindingsNew(
    namespace: string,
    filters?: {
      roleName?: string;
      roleNamespace?: string;
      claim?: string;
      value?: string;
      effect?: string;
    },
    userToken?: string,
  ): Promise<{ data: Array<any> }> {
    this.logger.debug(
      `Fetching namespace role bindings for: ${namespace} (new API)`,
      { filters },
    );

    try {
      const client = this.createNewClient(userToken);
      const query: Record<string, string | undefined> = {};
      if (filters?.roleName) query.roleName = filters.roleName;
      if (filters?.roleNamespace) query.roleNamespace = filters.roleNamespace;
      if (filters?.claim) query.claim = filters.claim;
      if (filters?.value) query.value = filters.value;
      if (filters?.effect) query.effect = filters.effect;

      const { data, error, response } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/rolebindings',
        {
          params: {
            path: { namespaceName: namespace },
            query: query as {
              roleName?: string;
              roleNamespace?: string;
              claim?: string;
              value?: string;
              effect?: 'allow' | 'deny';
            },
          },
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to fetch namespace role bindings',
        );
        throw new Error(errorMsg);
      }

      this.logger.debug(
        `Successfully fetched ${data?.length || 0} namespace role bindings`,
      );

      return { data: data || [] };
    } catch (err) {
      this.logger.error(`Failed to fetch namespace role bindings: ${err}`);
      throw err;
    }
  }

  async getNamespaceRoleBinding(
    namespace: string,
    name: string,
    userToken?: string,
  ): Promise<{ data: any }> {
    if (this.useNewApi) {
      return this.getNamespaceRoleBindingNew(namespace, name, userToken);
    }
    return this.getNamespaceRoleBindingLegacy(namespace, name, userToken);
  }

  private async getNamespaceRoleBindingLegacy(
    namespace: string,
    name: string,
    userToken?: string,
  ): Promise<{ data: any }> {
    this.logger.debug(`Fetching namespace role binding: ${namespace}/${name}`);

    try {
      const client = this.createClient(userToken);
      const { data, error, response } = await client.GET(
        '/namespaces/{namespace}/rolebindings/{name}',
        {
          params: { path: { namespace, name } },
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to fetch namespace role binding',
        );
        throw new Error(errorMsg);
      }

      const bindingResponse = data as { data: any };
      return { data: bindingResponse.data };
    } catch (err) {
      this.logger.error(
        `Failed to fetch namespace role binding ${namespace}/${name}: ${err}`,
      );
      throw err;
    }
  }

  private async getNamespaceRoleBindingNew(
    namespace: string,
    name: string,
    userToken?: string,
  ): Promise<{ data: any }> {
    this.logger.debug(
      `Fetching namespace role binding: ${namespace}/${name} (new API)`,
    );

    try {
      const client = this.createNewClient(userToken);
      const { data, error, response } = await client.GET(
        '/api/v1/namespaces/{namespaceName}/rolebindings/{name}',
        {
          params: { path: { namespaceName: namespace, name } },
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to fetch namespace role binding',
        );
        throw new Error(errorMsg);
      }

      return { data };
    } catch (err) {
      this.logger.error(
        `Failed to fetch namespace role binding ${namespace}/${name}: ${err}`,
      );
      throw err;
    }
  }

  async createNamespaceRoleBinding(
    binding: any,
    userToken?: string,
  ): Promise<{ data: any }> {
    if (this.useNewApi) {
      return this.createNamespaceRoleBindingNew(binding, userToken);
    }
    return this.createNamespaceRoleBindingLegacy(binding, userToken);
  }

  private async createNamespaceRoleBindingLegacy(
    binding: any,
    userToken?: string,
  ): Promise<{ data: any }> {
    this.logger.debug(
      `Creating namespace role binding: ${binding.namespace}/${binding.name}`,
    );

    try {
      const client = this.createClient(userToken);
      const { data, error, response } = await client.POST(
        '/namespaces/{namespace}/rolebindings',
        {
          params: { path: { namespace: binding.namespace } },
          body: binding,
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to create namespace role binding',
        );
        throw new Error(errorMsg);
      }

      const bindingResponse = data as { data: any };
      this.logger.debug(
        `Successfully created namespace role binding: ${binding.namespace}/${binding.name}`,
      );
      return { data: bindingResponse.data };
    } catch (err) {
      this.logger.error(`Failed to create namespace role binding: ${err}`);
      throw err;
    }
  }

  private async createNamespaceRoleBindingNew(
    binding: any,
    userToken?: string,
  ): Promise<{ data: any }> {
    this.logger.debug(
      `Creating namespace role binding: ${binding.namespace}/${binding.name} (new API)`,
    );

    try {
      const client = this.createNewClient(userToken);
      const { data, error, response } = await client.POST(
        '/api/v1/namespaces/{namespaceName}/rolebindings',
        {
          params: { path: { namespaceName: binding.namespace } },
          body: binding,
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to create namespace role binding',
        );
        throw new Error(errorMsg);
      }

      this.logger.debug(
        `Successfully created namespace role binding: ${binding.namespace}/${binding.name}`,
      );
      return { data };
    } catch (err) {
      this.logger.error(`Failed to create namespace role binding: ${err}`);
      throw err;
    }
  }

  async updateNamespaceRoleBinding(
    namespace: string,
    name: string,
    binding: any,
    userToken?: string,
  ): Promise<{ data: any }> {
    if (this.useNewApi) {
      return this.updateNamespaceRoleBindingNew(
        namespace,
        name,
        binding,
        userToken,
      );
    }
    return this.updateNamespaceRoleBindingLegacy(
      namespace,
      name,
      binding,
      userToken,
    );
  }

  private async updateNamespaceRoleBindingLegacy(
    namespace: string,
    name: string,
    binding: any,
    userToken?: string,
  ): Promise<{ data: any }> {
    this.logger.debug(`Updating namespace role binding: ${namespace}/${name}`);

    try {
      const client = this.createClient(userToken);
      const { data, error, response } = await client.PUT(
        '/namespaces/{namespace}/rolebindings/{name}',
        {
          params: { path: { namespace, name } },
          body: binding,
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to update namespace role binding',
        );
        throw new Error(errorMsg);
      }

      const bindingResponse = data as { data: any };
      this.logger.debug(
        `Successfully updated namespace role binding: ${namespace}/${name}`,
      );
      return { data: bindingResponse.data };
    } catch (err) {
      this.logger.error(
        `Failed to update namespace role binding ${namespace}/${name}: ${err}`,
      );
      throw err;
    }
  }

  private async updateNamespaceRoleBindingNew(
    namespace: string,
    name: string,
    binding: any,
    userToken?: string,
  ): Promise<{ data: any }> {
    this.logger.debug(
      `Updating namespace role binding: ${namespace}/${name} (new API)`,
    );

    try {
      const client = this.createNewClient(userToken);
      const { data, error, response } = await client.PUT(
        '/api/v1/namespaces/{namespaceName}/rolebindings/{name}',
        {
          params: { path: { namespaceName: namespace, name } },
          body: binding,
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to update namespace role binding',
        );
        throw new Error(errorMsg);
      }

      this.logger.debug(
        `Successfully updated namespace role binding: ${namespace}/${name}`,
      );
      return { data };
    } catch (err) {
      this.logger.error(
        `Failed to update namespace role binding ${namespace}/${name}: ${err}`,
      );
      throw err;
    }
  }

  async deleteNamespaceRoleBinding(
    namespace: string,
    name: string,
    userToken?: string,
  ): Promise<void> {
    if (this.useNewApi) {
      return this.deleteNamespaceRoleBindingNew(namespace, name, userToken);
    }
    return this.deleteNamespaceRoleBindingLegacy(namespace, name, userToken);
  }

  private async deleteNamespaceRoleBindingLegacy(
    namespace: string,
    name: string,
    userToken?: string,
  ): Promise<void> {
    this.logger.debug(`Deleting namespace role binding: ${namespace}/${name}`);

    try {
      const client = this.createClient(userToken);
      const { error, response } = await client.DELETE(
        '/namespaces/{namespace}/rolebindings/{name}',
        {
          params: { path: { namespace, name } },
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to delete namespace role binding',
        );
        throw new Error(errorMsg);
      }

      this.logger.debug(
        `Successfully deleted namespace role binding: ${namespace}/${name}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to delete namespace role binding ${namespace}/${name}: ${err}`,
      );
      throw err;
    }
  }

  private async deleteNamespaceRoleBindingNew(
    namespace: string,
    name: string,
    userToken?: string,
  ): Promise<void> {
    this.logger.debug(
      `Deleting namespace role binding: ${namespace}/${name} (new API)`,
    );

    try {
      const client = this.createNewClient(userToken);
      const { error, response } = await client.DELETE(
        '/api/v1/namespaces/{namespaceName}/rolebindings/{name}',
        {
          params: { path: { namespaceName: namespace, name } },
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to delete namespace role binding',
        );
        throw new Error(errorMsg);
      }

      this.logger.debug(
        `Successfully deleted namespace role binding: ${namespace}/${name}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to delete namespace role binding ${namespace}/${name}: ${err}`,
      );
      throw err;
    }
  }

  // =====================
  // Binding Lookup & Force-Delete Methods
  // (These are composite methods that delegate to primitive methods above,
  // so they auto-migrate with no changes needed)
  // =====================

  async listBindingsForRole(
    roleName: string,
    roleScope: 'cluster' | 'namespace',
    roleNamespace?: string,
    userToken?: string,
  ): Promise<{
    clusterRoleBindings: Array<any>;
    namespaceRoleBindings: Array<any & { namespace: string }>;
  }> {
    this.logger.debug(
      `Listing bindings for role: ${roleName} (scope: ${roleScope})`,
    );

    if (roleScope === 'cluster') {
      const [clusterBindingsResult, namespacesResult] = await Promise.all([
        this.listClusterRoleBindings({ roleName }, userToken),
        this.listNamespaces(userToken),
      ]);

      const namespaces = namespacesResult.data || [];
      const nsBindingResults = await Promise.all(
        namespaces.map(async ns => {
          const result = await this.listNamespaceRoleBindings(
            ns.name,
            { roleName },
            userToken,
          );
          return result.data
            .filter(b => !b.role?.namespace)
            .map(b => ({ ...b, namespace: ns.name }));
        }),
      );

      return {
        clusterRoleBindings: clusterBindingsResult.data,
        namespaceRoleBindings: nsBindingResults.flat(),
      };
    }

    // namespace scope
    if (!roleNamespace) {
      throw new Error('roleNamespace is required for namespace-scoped roles');
    }

    const nsBindings = await this.listNamespaceRoleBindings(
      roleNamespace,
      { roleName, roleNamespace },
      userToken,
    );

    return {
      clusterRoleBindings: [],
      namespaceRoleBindings: nsBindings.data.map(b => ({
        ...b,
        namespace: roleNamespace,
      })),
    };
  }

  async forceDeleteClusterRole(
    name: string,
    userToken?: string,
  ): Promise<{
    deletedBindings: string[];
    failedBindings: Array<{ name: string; error: string }>;
    roleDeleted: boolean;
  }> {
    this.logger.debug(`Force-deleting cluster role: ${name}`);

    // Fetch authoritative binding lists server-side
    const { clusterRoleBindings, namespaceRoleBindings } =
      await this.listBindingsForRole(name, 'cluster', undefined, userToken);

    const deletedBindings: string[] = [];
    const failedBindings: Array<{ name: string; error: string }> = [];

    // Delete all cluster bindings
    const clusterResults = await Promise.allSettled(
      clusterRoleBindings.map(b =>
        this.deleteClusterRoleBinding(b.name, userToken),
      ),
    );
    clusterResults.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        deletedBindings.push(clusterRoleBindings[i].name);
      } else {
        failedBindings.push({
          name: clusterRoleBindings[i].name,
          error:
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
        });
      }
    });

    // Delete all namespace bindings
    const nsResults = await Promise.allSettled(
      namespaceRoleBindings.map(b =>
        this.deleteNamespaceRoleBinding(b.namespace, b.name, userToken),
      ),
    );
    nsResults.forEach((result, i) => {
      const bindingId = `${namespaceRoleBindings[i].namespace}/${namespaceRoleBindings[i].name}`;
      if (result.status === 'fulfilled') {
        deletedBindings.push(bindingId);
      } else {
        failedBindings.push({
          name: bindingId,
          error:
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
        });
      }
    });

    // Only delete the role if all bindings were successfully deleted
    if (failedBindings.length > 0) {
      this.logger.warn(
        `Cannot delete cluster role ${name}: ${failedBindings.length} binding(s) failed to delete`,
      );
      return { deletedBindings, failedBindings, roleDeleted: false };
    }

    await this.deleteClusterRole(name, userToken);
    return { deletedBindings, failedBindings, roleDeleted: true };
  }

  async forceDeleteNamespaceRole(
    namespace: string,
    name: string,
    userToken?: string,
  ): Promise<{
    deletedBindings: string[];
    failedBindings: Array<{ name: string; error: string }>;
    roleDeleted: boolean;
  }> {
    this.logger.debug(`Force-deleting namespace role: ${namespace}/${name}`);

    // Fetch authoritative binding lists server-side
    const { namespaceRoleBindings } = await this.listBindingsForRole(
      name,
      'namespace',
      namespace,
      userToken,
    );

    const deletedBindings: string[] = [];
    const failedBindings: Array<{ name: string; error: string }> = [];

    const results = await Promise.allSettled(
      namespaceRoleBindings.map(b =>
        this.deleteNamespaceRoleBinding(b.namespace, b.name, userToken),
      ),
    );
    results.forEach((result, i) => {
      const bindingId = `${namespaceRoleBindings[i].namespace}/${namespaceRoleBindings[i].name}`;
      if (result.status === 'fulfilled') {
        deletedBindings.push(bindingId);
      } else {
        failedBindings.push({
          name: bindingId,
          error:
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
        });
      }
    });

    if (failedBindings.length > 0) {
      this.logger.warn(
        `Cannot delete namespace role ${namespace}/${name}: ${failedBindings.length} binding(s) failed to delete`,
      );
      return { deletedBindings, failedBindings, roleDeleted: false };
    }

    await this.deleteNamespaceRole(namespace, name, userToken);
    return { deletedBindings, failedBindings, roleDeleted: true };
  }
}
