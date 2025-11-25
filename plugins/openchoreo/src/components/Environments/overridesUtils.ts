/**
 * Utility functions for environment overrides calculations.
 */

/**
 * Check if object has any keys/values
 */
export function hasData(data: Record<string, unknown> | undefined): boolean {
  return data !== undefined && Object.keys(data).length > 0;
}

/**
 * Check if any trait has overrides
 */
export function hasAnyTraitOverrides(
  traitMap: Record<string, Record<string, unknown>>,
): boolean {
  return Object.values(traitMap).some(data => Object.keys(data).length > 0);
}

/**
 * Calculate if there are any overrides (component or trait)
 */
export function calculateHasOverrides(
  componentData: Record<string, unknown>,
  traitMap: Record<string, Record<string, unknown>>,
): {
  hasComponentOverrides: boolean;
  hasTraitOverrides: boolean;
  hasAny: boolean;
} {
  const hasComponentOverrides = hasData(componentData);
  const hasTraitOverrides = hasAnyTraitOverrides(traitMap);
  return {
    hasComponentOverrides,
    hasTraitOverrides,
    hasAny: hasComponentOverrides || hasTraitOverrides,
  };
}
