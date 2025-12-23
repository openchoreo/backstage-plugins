import { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  type OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';

// Type definitions from the OpenAPI spec
export type Role = OpenChoreoComponents['schemas']['Role'];
export type Entitlement = OpenChoreoComponents['schemas']['Entitlement'];
export type ResourceHierarchy =
  OpenChoreoComponents['schemas']['AuthzResourceHierarchy'];
export type RoleEntitlementMapping =
  OpenChoreoComponents['schemas']['RoleEntitlementMapping'];
export type UserTypeConfig = OpenChoreoComponents['schemas']['UserTypeConfig'];
export type PolicyEffect = OpenChoreoComponents['schemas']['PolicyEffectType'];

// Response types
type RolesListResponse = OpenChoreoComponents['schemas']['APIResponse'] & {
  data?: Role[];
};

type RoleResponse = OpenChoreoComponents['schemas']['APIResponse'] & {
  data?: Role;
};

type RoleMappingsListResponse =
  OpenChoreoComponents['schemas']['APIResponse'] & {
    data?: RoleEntitlementMapping[];
  };

type RoleMappingResponse = OpenChoreoComponents['schemas']['APIResponse'] & {
  data?: RoleEntitlementMapping;
};

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

  // Roles
  async listRoles(userToken?: string): Promise<{ data: Role[] }> {
    this.logger.debug('Fetching all roles');

    try {
      const client = this.createClient(userToken);
      const { data, error, response } = await client.GET('/authz/roles');

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to fetch roles',
        );
        throw new Error(errorMsg);
      }

      const rolesResponse = data as RolesListResponse;
      this.logger.debug(
        `Successfully fetched ${rolesResponse.data?.length || 0} roles`,
      );

      return { data: rolesResponse.data || [] };
    } catch (err) {
      this.logger.error(`Failed to fetch roles: ${err}`);
      throw err;
    }
  }

  async getRole(name: string, userToken?: string): Promise<{ data: Role }> {
    this.logger.debug(`Fetching role: ${name}`);

    try {
      const client = this.createClient(userToken);
      const { data, error, response } = await client.GET(
        '/authz/roles/{roleName}',
        {
          params: {
            path: { roleName: name },
          },
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to fetch role',
        );
        throw new Error(errorMsg);
      }

      const roleResponse = data as RoleResponse;
      return { data: roleResponse.data! };
    } catch (err) {
      this.logger.error(`Failed to fetch role ${name}: ${err}`);
      throw err;
    }
  }

  async addRole(role: Role, userToken?: string): Promise<{ data: Role }> {
    this.logger.debug(`Creating role: ${role.name}`);

    try {
      const client = this.createClient(userToken);
      const { data, error, response } = await client.POST('/authz/roles', {
        body: role,
      });

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to create role',
        );
        throw new Error(errorMsg);
      }

      const roleResponse = data as RoleResponse;
      this.logger.debug(`Successfully created role: ${role.name}`);

      return { data: roleResponse.data! };
    } catch (err) {
      this.logger.error(`Failed to create role ${role.name}: ${err}`);
      throw err;
    }
  }

  async updateRole(
    name: string,
    actions: string[],
    userToken?: string,
  ): Promise<{ data: Role }> {
    this.logger.debug(`Updating role: ${name}`);

    try {
      const client = this.createClient(userToken);
      const { data, error, response } = await client.PUT(
        '/authz/roles/{roleName}',
        {
          params: {
            path: { roleName: name },
          },
          body: { actions },
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to update role',
        );
        throw new Error(errorMsg);
      }

      const roleResponse = data as RoleResponse;
      this.logger.debug(`Successfully updated role: ${name}`);

      return { data: roleResponse.data! };
    } catch (err) {
      this.logger.error(`Failed to update role ${name}: ${err}`);
      throw err;
    }
  }

  async removeRole(name: string, force?: boolean, userToken?: string): Promise<void> {
    this.logger.debug(`Deleting role: ${name}`, { force });

    try {
      const client = this.createClient(userToken);
      const { error, response } = await client.DELETE(
        '/authz/roles/{roleName}',
        {
          params: {
            path: { roleName: name },
            query: force ? { force: true } : undefined,
          },
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to delete role',
        );
        throw new Error(errorMsg);
      }

      this.logger.debug(`Successfully deleted role: ${name}`);
    } catch (err) {
      this.logger.error(`Failed to delete role ${name}: ${err}`);
      throw err;
    }
  }

  // Role Mappings
  async listRoleMappings(
    filters?: { role?: string; claim?: string; value?: string },
    userToken?: string,
  ): Promise<{ data: RoleEntitlementMapping[] }> {
    this.logger.debug('Fetching role mappings', { filters });

    try {
      const client = this.createClient(userToken);

      // Build query params, only including defined values
      const query: { role?: string; claim?: string; value?: string } = {};
      if (filters?.role) query.role = filters.role;
      if (filters?.claim) query.claim = filters.claim;
      if (filters?.value) query.value = filters.value;

      const { data, error, response } = await client.GET(
        '/authz/role-mappings',
        {
          params: { query },
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to fetch role mappings',
        );
        throw new Error(errorMsg);
      }

      const mappingsResponse = data as RoleMappingsListResponse;
      this.logger.debug(
        `Successfully fetched ${
          mappingsResponse.data?.length || 0
        } role mappings`,
      );

      return { data: mappingsResponse.data || [] };
    } catch (err) {
      this.logger.error(`Failed to fetch role mappings: ${err}`);
      throw err;
    }
  }

  async addRoleMapping(
    mapping: RoleEntitlementMapping,
    userToken?: string,
  ): Promise<{ data: RoleEntitlementMapping }> {
    this.logger.debug(`Creating role mapping for role: ${mapping.role_name}`);

    try {
      const client = this.createClient(userToken);
      const { data, error, response } = await client.POST(
        '/authz/role-mappings',
        {
          body: mapping,
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to create role mapping',
        );
        throw new Error(errorMsg);
      }

      const mappingResponse = data as RoleMappingResponse;
      this.logger.debug(
        `Successfully created role mapping for role: ${mapping.role_name}`,
      );

      return { data: mappingResponse.data! };
    } catch (err) {
      this.logger.error(`Failed to create role mapping: ${err}`);
      throw err;
    }
  }

  async removeRoleMapping(
    mappingId: number,
    userToken?: string,
  ): Promise<void> {
    this.logger.debug(`Deleting role mapping with ID: ${mappingId}`);

    try {
      const client = this.createClient(userToken);
      const { error, response } = await client.DELETE(
        '/authz/role-mappings/{mappingId}',
        {
          params: { path: { mappingId } },
        },
      );

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to delete role mapping',
        );
        throw new Error(errorMsg);
      }

      this.logger.debug(
        `Successfully deleted role mapping with ID: ${mappingId}`,
      );
    } catch (err) {
      this.logger.error(`Failed to delete role mapping: ${err}`);
      throw err;
    }
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

  // Organizations
  async listOrganizations(
    userToken?: string,
  ): Promise<{ data: Array<{ name: string; displayName?: string }> }> {
    this.logger.debug('Fetching all organizations');

    try {
      const client = this.createClient(userToken);
      const { data, error, response } = await client.GET('/orgs');

      if (error || !response.ok) {
        const errorMsg = extractErrorMessage(
          error,
          response,
          'Failed to fetch organizations',
        );
        throw new Error(errorMsg);
      }

      // OpenChoreo API returns { data: { items: [...] } }
      const orgsResponse = data as {
        data?: { items?: Array<{ name: string }> };
      };
      const items = orgsResponse.data?.items || [];
      this.logger.debug(`Successfully fetched ${items.length} organizations`);

      return { data: items };
    } catch (err) {
      this.logger.error(`Failed to fetch organizations: ${err}`);
      throw err;
    }
  }

  // Projects
  async listProjects(
    orgName: string,
    userToken?: string,
  ): Promise<{ data: Array<{ name: string; displayName?: string }> }> {
    this.logger.debug(`Fetching projects for organization: ${orgName}`);

    try {
      const client = this.createClient(userToken);
      const { data, error, response } = await client.GET(
        '/orgs/{orgName}/projects',
        {
          params: { path: { orgName } },
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
        `Successfully fetched ${items.length} projects for org ${orgName}`,
      );

      return { data: items };
    } catch (err) {
      this.logger.error(`Failed to fetch projects for org ${orgName}: ${err}`);
      throw err;
    }
  }

  // Components
  async listComponents(
    orgName: string,
    projectName: string,
    userToken?: string,
  ): Promise<{ data: Array<{ name: string; displayName?: string }> }> {
    this.logger.debug(
      `Fetching components for org: ${orgName}, project: ${projectName}`,
    );

    try {
      const client = this.createClient(userToken);
      const { data, error, response } = await client.GET(
        '/orgs/{orgName}/projects/{projectName}/components',
        {
          params: { path: { orgName, projectName } },
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
        `Successfully fetched ${items.length} components for ${orgName}/${projectName}`,
      );

      return { data: items };
    } catch (err) {
      this.logger.error(
        `Failed to fetch components for ${orgName}/${projectName}: ${err}`,
      );
      throw err;
    }
  }
}
