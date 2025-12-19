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
  UserCapabilitiesResponse,
  OpenChoreoScope,
} from './services';

// Re-export permission rules and condition exports for integration
export {
  matchesCapability,
  openchoreoComponentResourceRef,
  openchoreoPermissionRules,
  openchoreoConditions,
  createOpenChoreoConditionalDecision,
  // Catalog entity permission rule (for catalog-entity resource type)
  matchesCatalogEntityCapability,
  openchoreoСatalogPermissionRules,
} from './rules';
export type {
  MatchesCapabilityParams,
  CatalogPermissionRule,
  MatchesCatalogEntityCapabilityParams,
} from './rules';
