/**
 * OpenChoreo permission policy module for Backstage.
 *
 * This module integrates the OpenChoreo authorization system with Backstage's
 * permission framework, allowing enterprises to use OpenChoreo's role-based
 * access control for Backstage permissions.
 *
 * @packageDocumentation
 */

export { permissionModuleOpenChoreoPolicy as default } from './module';
export { permissionModuleOpenChoreoPolicy } from './module';

// Re-export policy for advanced usage
export { OpenChoreoPermissionPolicy } from './policy';
export type { OpenChoreoPermissionPolicyOptions } from './policy';

// Re-export services for testing and customization
export { AuthzProfileService, AuthzProfileCache } from './services';
export type {
  AuthzProfileServiceOptions,
  AuthzProfileCacheOptions,
  UserCapabilitiesResponse,
  OpenChoreoScope,
} from './services';
