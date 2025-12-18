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
 * All OpenChoreo permissions exported as an array.
 * Useful for registering all permissions with the permission framework.
 */
export const openchoreoPermissions = [
  openchoreoComponentCreatePermission,
  openchoreoComponentReadPermission,
  openchoreoComponentBuildPermission,
  openchoreoComponentDeployPermission,
  openchoreoComponentUpdatePermission,
  openchoreoProjectCreatePermission,
  openchoreoProjectReadPermission,
  openchoreoOrganizationReadPermission,
  openchoreoEnvironmentCreatePermission,
  openchoreoEnvironmentReadPermission,
  openchoreoReleaseCreatePermission,
  openchoreoReleaseReadPermission,
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
  'openchoreo.component.build': 'componentworkflow:trigger',
  'openchoreo.component.deploy': 'component:deploy',
  'openchoreo.project.create': 'project:create',
  'openchoreo.project.read': 'project:view',
  'openchoreo.organization.read': 'organization:view',
  'openchoreo.environment.create': 'environment:create',
  'openchoreo.environment.read': 'environment:view',
  'openchoreo.release.create': 'componentrelease:create',
  'openchoreo.release.read': 'componentrelease:view',
};
