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
 * Resource-based: requires the specific component context.
 */
export const openchoreoComponentBuildPermission = createPermission({
  name: 'openchoreo.component.build',
  attributes: { action: 'update' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_COMPONENT,
});

/**
 * Permission to view builds of a component.
 * Resource-based: requires the specific component context.
 */
export const openchoreoComponentViewBuildsPermission = createPermission({
  name: 'openchoreo.component.viewbuilds',
  attributes: { action: 'update' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_COMPONENT,
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
 * Permission to read/view a project.
 * Resource-based: requires the specific project context.
 */
export const openchoreoProjectReadPermission = createPermission({
  name: 'openchoreo.project.read',
  attributes: { action: 'read' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_PROJECT,
});

/**
 * Permission to read/view organization details.
 * Org-scoped permission.
 */
export const openchoreoOrganizationReadPermission = createPermission({
  name: 'openchoreo.organization.read',
  attributes: { action: 'read' },
});

/**
 * Permission to create a new environment.
 * Requires organization context.
 */
export const openchoreoEnvironmentCreatePermission = createPermission({
  name: 'openchoreo.environment.create',
  attributes: { action: 'create' },
});

/**
 * Permission to read/view environments.
 * Org-scoped permission.
 */
export const openchoreoEnvironmentReadPermission = createPermission({
  name: 'openchoreo.environment.read',
  attributes: { action: 'read' },
});

/**
 * Permission to create a new component release.
 * Requires component context.
 */
export const openchoreoReleaseCreatePermission = createPermission({
  name: 'openchoreo.release.create',
  attributes: { action: 'create' },
});

/**
 * Permission to read/view component releases.
 * Org-scoped permission.
 */
export const openchoreoReleaseReadPermission = createPermission({
  name: 'openchoreo.release.read',
  attributes: { action: 'read' },
});

/**
 * Permission to view roles.
 * Org-scoped permission.
 */
export const openchoreoRoleViewPermission = createPermission({
  name: 'openchoreo.role.view',
  attributes: { action: 'read' },
});

/**
 * Permission to create a new role.
 * Org-scoped permission.
 */
export const openchoreoRoleCreatePermission = createPermission({
  name: 'openchoreo.role.create',
  attributes: { action: 'create' },
});

/**
 * Permission to update an existing role.
 * Org-scoped permission.
 */
export const openchoreoRoleUpdatePermission = createPermission({
  name: 'openchoreo.role.update',
  attributes: { action: 'update' },
});

/**
 * Permission to delete a role.
 * Org-scoped permission.
 */
export const openchoreoRoleDeletePermission = createPermission({
  name: 'openchoreo.role.delete',
  attributes: { action: 'delete' },
});

/**
 * Permission to view role mappings.
 * Org-scoped permission.
 */
export const openchoreoRoleMappingViewPermission = createPermission({
  name: 'openchoreo.rolemapping.view',
  attributes: { action: 'read' },
});

/**
 * Permission to create a new role mapping.
 * Org-scoped permission.
 */
export const openchoreoRoleMappingCreatePermission = createPermission({
  name: 'openchoreo.rolemapping.create',
  attributes: { action: 'create' },
});

/**
 * Permission to update an existing role mapping.
 * Org-scoped permission.
 */
export const openchoreoRoleMappingUpdatePermission = createPermission({
  name: 'openchoreo.rolemapping.update',
  attributes: { action: 'update' },
});

/**
 * Permission to delete a role mapping.
 * Org-scoped permission.
 */
export const openchoreoRoleMappingDeletePermission = createPermission({
  name: 'openchoreo.rolemapping.delete',
  attributes: { action: 'delete' },
});

/**
 * Permission to view logs for a component.
 * Resource-based: requires the specific component context.
 */
export const openchoreoLogsViewPermission = createPermission({
  name: 'openchoreo.logs.view',
  attributes: { action: 'read' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_COMPONENT,
});

/**
 * Permission to view metrics for a component.
 * Resource-based: requires the specific component context.
 */
export const openchoreoMetricsViewPermission = createPermission({
  name: 'openchoreo.metrics.view',
  attributes: { action: 'read' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_COMPONENT,
});

/**
 * All OpenChoreo permissions exported as an array.
 * Useful for registering all permissions with the permission framework.
 */
export const openchoreoPermissions = [
  openchoreoComponentCreatePermission,
  openchoreoComponentReadPermission,
  openchoreoComponentBuildPermission,
  openchoreoComponentViewBuildsPermission,
  openchoreoComponentDeployPermission,
  openchoreoComponentUpdatePermission,
  openchoreoProjectCreatePermission,
  openchoreoProjectReadPermission,
  openchoreoOrganizationReadPermission,
  openchoreoEnvironmentCreatePermission,
  openchoreoEnvironmentReadPermission,
  openchoreoReleaseCreatePermission,
  openchoreoReleaseReadPermission,
  openchoreoRoleViewPermission,
  openchoreoRoleCreatePermission,
  openchoreoRoleUpdatePermission,
  openchoreoRoleDeletePermission,
  openchoreoRoleMappingViewPermission,
  openchoreoRoleMappingCreatePermission,
  openchoreoRoleMappingUpdatePermission,
  openchoreoRoleMappingDeletePermission,
  openchoreoLogsViewPermission,
  openchoreoMetricsViewPermission,
];

/**
 * Mapping from OpenChoreo permission names to OpenChoreo API action names.
 * Used by the permission policy to translate Backstage permission checks
 * to OpenChoreo capability checks.
 */
export const OPENCHOREO_PERMISSION_TO_ACTION: Record<string, string> = {
  'openchoreo.component.create': 'component:create',
  'openchoreo.component.read': 'component:view',
  'openchoreo.component.update': 'component:update',
  'openchoreo.component.build': 'componentworkflow:create',
  'openchoreo.component.viewbuilds': 'componentworkflow:view',
  'openchoreo.component.deploy': 'component:deploy',
  'openchoreo.project.create': 'project:create',
  'openchoreo.project.read': 'project:view',
  'openchoreo.organization.read': 'organization:view',
  'openchoreo.environment.create': 'environment:create',
  'openchoreo.environment.read': 'environment:view',
  'openchoreo.release.create': 'componentrelease:create',
  'openchoreo.release.read': 'componentrelease:view',
  'openchoreo.role.view': 'role:view',
  'openchoreo.role.create': 'role:create',
  'openchoreo.role.update': 'role:update',
  'openchoreo.role.delete': 'role:delete',
  'openchoreo.rolemapping.view': 'rolemapping:view',
  'openchoreo.rolemapping.create': 'rolemapping:create',
  'openchoreo.rolemapping.update': 'rolemapping:update',
  'openchoreo.rolemapping.delete': 'rolemapping:delete',
  'openchoreo.logs.view': 'logs:view',
  'openchoreo.metrics.view': 'metrics:view',
};

/**
 * Mapping from Backstage catalog permissions to OpenChoreo API action names.
 * Used to translate native Backstage catalog.entity.* permissions to OpenChoreo
 * capability checks when the entity is an OpenChoreo-managed component.
 */
export const CATALOG_PERMISSION_TO_ACTION: Record<string, string> = {
  'catalog.entity.read': 'component:view',
  'catalog.entity.delete': 'component:delete',
  'catalog.entity.refresh': 'component:update',
};

/**
 * Entity kinds that should be checked against OpenChoreo permissions
 * when catalog.entity.* permissions are evaluated.
 *
 * - Component: Maps to OpenChoreo components
 * - System: Maps to OpenChoreo projects
 * - Domain: Maps to OpenChoreo organizations
 */
export const OPENCHOREO_MANAGED_ENTITY_KINDS = [
  'Component',
  'System',
  'Domain',
];

/**
 * Mapping from entity kind to the OpenChoreo action for each catalog permission.
 * Used to translate native Backstage catalog.entity.* permissions to OpenChoreo
 * capability checks based on the entity kind.
 *
 * Each kind maps to a different resource type in OpenChoreo:
 * - Component → component:* actions
 * - System → project:* actions
 * - Domain → organization:* actions
 */
export const CATALOG_KIND_TO_ACTION: Record<string, Record<string, string>> = {
  component: {
    'catalog.entity.read': 'component:view',
    'catalog.entity.delete': 'component:delete',
    'catalog.entity.refresh': 'component:update',
  },
  system: {
    'catalog.entity.read': 'project:view',
  },
  domain: {
    'catalog.entity.read': 'organization:view',
  },
};
