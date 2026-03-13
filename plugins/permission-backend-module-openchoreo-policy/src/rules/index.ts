import { createConditionExports } from '@backstage/plugin-permission-node';
import {
  matchesCapability,
  openchoreoNamespacedResourceRef,
} from './matchesCapability';
import { matchesCatalogEntityCapability } from './matchesCatalogEntityCapability';

export {
  matchesCapability,
  openchoreoNamespacedResourceRef,
} from './matchesCapability';
export type { MatchesCapabilityParams } from './matchesCapability';

export {
  matchesCatalogEntityCapability,
  type MatchesCatalogEntityCapabilityParams,
  type KindCapability,
  type KindCapabilities,
} from './matchesCatalogEntityCapability';

/**
 * All OpenChoreo permission rules as a Record (required by createConditionExports).
 */
export const openchoreoPermissionRules = { matchesCapability };

/**
 * All catalog entity permission rules for OpenChoreo.
 * These rules work with the catalog-entity resource type.
 */
export const openchoreoСatalogPermissionRules = {
  matchesCatalogEntityCapability,
};

/**
 * Condition exports for OpenChoreo component permissions.
 * Provides helper functions for creating conditional decisions.
 */
const { conditions, createConditionalDecision } = createConditionExports({
  resourceRef: openchoreoNamespacedResourceRef,
  rules: openchoreoPermissionRules,
});

/**
 * OpenChoreo permission conditions.
 * Use these to create conditional permission decisions.
 *
 * @example
 * ```typescript
 * // In a permission policy
 * return createOpenChoreoConditionalDecision(
 *   request.permission,
 *   openchoreoConditions.matchesCapability({
 *     action: 'releasebinding:create',
 *     capability: { allowed: [{ path: 'namespace/*' }] }
 *   })
 * );
 * ```
 */
export const openchoreoConditions = conditions;

/**
 * Creates a conditional decision for OpenChoreo permissions.
 */
export const createOpenChoreoConditionalDecision = createConditionalDecision;
