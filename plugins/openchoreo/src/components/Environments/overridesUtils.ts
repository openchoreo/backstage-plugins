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
 * Check if workload has overrides
 */
export function hasWorkloadOverridesData(
  workloadData: Record<string, unknown> | undefined,
): boolean {
  return workloadData !== undefined && Object.keys(workloadData).length > 0;
}

/**
 * Calculate if there are any overrides (component, trait, or workload)
 */
export function calculateHasOverrides(
  componentData: Record<string, unknown>,
  traitMap: Record<string, Record<string, unknown>>,
  workloadData: Record<string, unknown>,
): {
  hasComponentOverrides: boolean;
  hasTraitOverrides: boolean;
  hasWorkloadOverrides: boolean;
  hasAny: boolean;
} {
  const hasComponentOverrides = hasData(componentData);
  const hasTraitOverrides = hasAnyTraitOverrides(traitMap);
  const hasWorkloadOverrides = hasWorkloadOverridesData(workloadData);
  return {
    hasComponentOverrides,
    hasTraitOverrides,
    hasWorkloadOverrides: hasWorkloadOverrides,
    hasAny: hasComponentOverrides || hasTraitOverrides || hasWorkloadOverrides,
  };
}
