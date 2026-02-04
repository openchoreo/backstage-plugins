import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  type OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';

// Type definitions from the OpenAPI spec
export type Entitlement = OpenChoreoComponents['schemas']['Entitlement'];
export type UserTypeConfig = OpenChoreoComponents['schemas']['UserTypeConfig'];

// Response types
type ActionsListResponse = OpenChoreoComponents['schemas']['APIResponse'] & {
  data?: string[];
};

type UserTypesListResponse = OpenChoreoComponents['schemas']['APIResponse'] & {
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

  constructor(logger: LoggerService, baseUrl: string) {
    this.logger = logger;
    this.baseUrl = baseUrl;
  }

  private createClient(token?: string) {
    return createOpenChoreoApiClient({
      baseUrl: this.baseUrl,
      token,
      logger: this.logger,
    });
  }

  // Actions
  async listActions(userToken?: string): Promise<{ data: string[] }> {
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

  // User Types
  async listUserTypes(userToken?: string): Promise<{ data: UserTypeConfig[] }> {
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

  // =====================
  // Hierarchy Data Methods (for Access Control autocomplete)
  // =====================

  // Namespaces
  async listNamespaces(
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

  // Projects
  async listProjects(
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

  // Components
  async listComponents(
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

  // =====================
  // Cluster & Namespace Scoped Authorization Methods
  // =====================

  // Cluster Roles
  async listClusterRoles(
    userToken?: string,
  ): Promise<{ data: Array<{ name: string; actions: string[]; description?: string }> }> {
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

  async getClusterRole(
    name: string,
    userToken?: string,
  ): Promise<{ data: { name: string; actions: string[]; description?: string } }> {
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

  async createClusterRole(
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

  async updateClusterRole(
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

  async deleteClusterRole(name: string, userToken?: string): Promise<void> {
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

  // Namespace Roles
  async listNamespaceRoles(
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
        `Successfully fetched ${rolesResponse.data?.length || 0} namespace roles`,
      );

      return { data: rolesResponse.data || [] };
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
      this.logger.error(`Failed to fetch namespace role ${namespace}/${name}: ${err}`);
      throw err;
    }
  }

  async createNamespaceRole(
    role: { name: string; namespace: string; actions: string[]; description?: string },
    userToken?: string,
  ): Promise<{ data: any }> {
    this.logger.debug(`Creating namespace role: ${role.namespace}/${role.name}`);

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
      this.logger.debug(`Successfully created namespace role: ${role.namespace}/${role.name}`);
      return { data: roleResponse.data };
    } catch (err) {
      this.logger.error(`Failed to create namespace role ${role.namespace}/${role.name}: ${err}`);
      throw err;
    }
  }

  async updateNamespaceRole(
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
      this.logger.debug(`Successfully updated namespace role: ${namespace}/${name}`);
      return { data: roleResponse.data };
    } catch (err) {
      this.logger.error(`Failed to update namespace role ${namespace}/${name}: ${err}`);
      throw err;
    }
  }

  async deleteNamespaceRole(
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

      this.logger.debug(`Successfully deleted namespace role: ${namespace}/${name}`);
    } catch (err) {
      this.logger.error(`Failed to delete namespace role ${namespace}/${name}: ${err}`);
      throw err;
    }
  }

  // Cluster Role Bindings
  async listClusterRoleBindings(
    filters?: { roleName?: string; claim?: string; value?: string; effect?: string },
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
        `Successfully fetched ${bindingsResponse.data?.length || 0} cluster role bindings`,
      );

      return { data: bindingsResponse.data || [] };
    } catch (err) {
      this.logger.error(`Failed to fetch cluster role bindings: ${err}`);
      throw err;
    }
  }

  async getClusterRoleBinding(
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

  async createClusterRoleBinding(
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
      this.logger.debug(`Successfully created cluster role binding: ${binding.name}`);
      return { data: bindingResponse.data };
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
      this.logger.error(`Failed to update cluster role binding ${name}: ${err}`);
      throw err;
    }
  }

  async deleteClusterRoleBinding(
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
      this.logger.error(`Failed to delete cluster role binding ${name}: ${err}`);
      throw err;
    }
  }

  // Namespace Role Bindings
  async listNamespaceRoleBindings(
    namespace: string,
    filters?: { roleName?: string; roleNamespace?: string; claim?: string; value?: string; effect?: string },
    userToken?: string,
  ): Promise<{ data: Array<any> }> {
    this.logger.debug(`Fetching namespace role bindings for: ${namespace}`, { filters });

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
        `Successfully fetched ${bindingsResponse.data?.length || 0} namespace role bindings`,
      );

      return { data: bindingsResponse.data || [] };
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
      this.logger.error(`Failed to fetch namespace role binding ${namespace}/${name}: ${err}`);
      throw err;
    }
  }

  async createNamespaceRoleBinding(
    binding: any,
    userToken?: string,
  ): Promise<{ data: any }> {
    this.logger.debug(`Creating namespace role binding: ${binding.namespace}/${binding.name}`);

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
      this.logger.debug(`Successfully created namespace role binding: ${binding.namespace}/${binding.name}`);
      return { data: bindingResponse.data };
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
      this.logger.debug(`Successfully updated namespace role binding: ${namespace}/${name}`);
      return { data: bindingResponse.data };
    } catch (err) {
      this.logger.error(`Failed to update namespace role binding ${namespace}/${name}: ${err}`);
      throw err;
    }
  }

  async deleteNamespaceRoleBinding(
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

      this.logger.debug(`Successfully deleted namespace role binding: ${namespace}/${name}`);
    } catch (err) {
      this.logger.error(`Failed to delete namespace role binding ${namespace}/${name}: ${err}`);
      throw err;
    }
  }
}
