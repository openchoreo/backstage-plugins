import { createPermission } from '@backstage/plugin-permission-common';

/**
 * Resource type identifiers for OpenChoreo entities.
 * Used for resource-based permission checks.
 */
export const OPENCHOREO_RESOURCE_TYPE_COMPONENT = 'openchoreo-component';
export const OPENCHOREO_RESOURCE_TYPE_PROJECT = 'openchoreo-project';

/**
 * Permission to create a new component.
 * Requires organization and project context.
 */
export const openchoreoComponentCreatePermission = createPermission({
  name: 'openchoreo.component.create',
  attributes: { action: 'create' },
});

/**
 * Permission to delete a component.
 * Resource-based: requires the specific component context.
 */
export const openchoreoComponentDeletePermission = createPermission({
  name: 'openchoreo.component.delete',
  attributes: { action: 'delete' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_COMPONENT,
});

/**
 * Permission to read/view a component.
 * Resource-based: requires the specific component context.
 */
export const openchoreoComponentReadPermission = createPermission({
  name: 'openchoreo.component.read',
  attributes: { action: 'read' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_COMPONENT,
});

/**
 * Permission to trigger a build for a component.
 * Note: Currently org-scoped. Will be resource-based when entity-level
 * authorization is implemented.
 */
export const openchoreoComponentBuildPermission = createPermission({
  name: 'openchoreo.component.build',
  attributes: { action: 'update' },
});

/**
 * Permission to deploy a component to an environment.
 * Resource-based: requires the specific component context.
 */
export const openchoreoComponentDeployPermission = createPermission({
  name: 'openchoreo.component.deploy',
  attributes: { action: 'update' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_COMPONENT,
});

/**
 * Permission to promote a component between environments.
 * Note: Currently org-scoped. Will be resource-based when entity-level
 * authorization is implemented.
 */
export const openchoreoComponentPromotePermission = createPermission({
  name: 'openchoreo.component.promote',
  attributes: { action: 'update' },
});

/**
 * Permission to update component configuration (traits, workload, etc.).
 * Resource-based: requires the specific component context.
 */
export const openchoreoComponentUpdatePermission = createPermission({
  name: 'openchoreo.component.update',
  attributes: { action: 'update' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_COMPONENT,
});

/**
 * Permission to create a new project.
 * Requires organization context.
 */
export const openchoreoProjectCreatePermission = createPermission({
  name: 'openchoreo.project.create',
  attributes: { action: 'create' },
});

/**
 * Permission to delete a project.
 * Resource-based: requires the specific project context.
 */
export const openchoreoProjectDeletePermission = createPermission({
  name: 'openchoreo.project.delete',
  attributes: { action: 'delete' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_PROJECT,
});

/**
 * Permission to manage access control settings (roles, role mappings).
 * Admin-level permission, typically org-scoped.
 */
export const openchoreoAccessControlManagePermission = createPermission({
  name: 'openchoreo.access-control.manage',
  attributes: { action: 'update' },
});

/**
 * Permission to manage roles.
 * Admin-level permission, typically org-scoped.
 */
export const openchoreoRolesManagePermission = createPermission({
  name: 'openchoreo.roles.manage',
  attributes: { action: 'update' },
});

/**
 * Permission to manage role mappings.
 * Admin-level permission, typically org-scoped.
 */
export const openchoreoRoleMappingsManagePermission = createPermission({
  name: 'openchoreo.role-mappings.manage',
  attributes: { action: 'update' },
});

/**
 * All OpenChoreo permissions exported as an array.
 * Useful for registering all permissions with the permission framework.
 */
export const openchoreoPermissions = [
  openchoreoComponentCreatePermission,
  openchoreoComponentDeletePermission,
  openchoreoComponentReadPermission,
  openchoreoComponentBuildPermission,
  openchoreoComponentDeployPermission,
  openchoreoComponentPromotePermission,
  openchoreoComponentUpdatePermission,
  openchoreoProjectCreatePermission,
  openchoreoProjectDeletePermission,
  openchoreoAccessControlManagePermission,
  openchoreoRolesManagePermission,
  openchoreoRoleMappingsManagePermission,
];

/**
 * Mapping from OpenChoreo permission names to OpenChoreo API action names.
 * Used by the permission policy to translate Backstage permission checks
 * to OpenChoreo capability checks.
 */
export const OPENCHOREO_PERMISSION_TO_ACTION: Record<string, string> = {
  'openchoreo.component.create': 'component.create',
  'openchoreo.component.delete': 'component.delete',
  'openchoreo.component.read': 'component.read',
  'openchoreo.component.build': 'build.trigger',
  'openchoreo.component.deploy': 'deployment.deploy',
  'openchoreo.component.promote': 'deployment.promote',
  'openchoreo.component.update': 'component.update',
  'openchoreo.project.create': 'project.create',
  'openchoreo.project.delete': 'project.delete',
  'openchoreo.access-control.manage': 'access-control.manage',
  'openchoreo.roles.manage': 'roles.manage',
  'openchoreo.role-mappings.manage': 'role-mappings.manage',
};
