import { useMemo } from 'react';
import {
  deepCompareObjects,
  type Change,
} from '@openchoreo/backstage-plugin-react';

// Re-export Change type for backward compatibility
export type { Change };

export interface GroupedChanges {
  component: Change[];
  traits: Record<string, Change[]>;
  workload?: Change[];
}

/**
 * Custom hook to calculate changes between initial and current override data
 * @param initialComponentTypeFormData - Initial component-type override data
 * @param componentTypeFormData - Current component-type override data
 * @param initialTraitFormDataMap - Initial trait overrides data (trait name -> data)
 * @param traitFormDataMap - Current trait overrides data (trait name -> data)
 * @param initialWorkloadFormData - Initial workload override data (optional)
 * @param workloadFormData - Current workload override data (optional)
 * @returns Grouped changes organized by component, traits, and workload
 */
export const useOverrideChanges = (
  initialComponentTypeFormData: any,
  componentTypeFormData: any,
  initialTraitFormDataMap: Record<string, any>,
  traitFormDataMap: Record<string, any>,
  initialWorkloadFormData?: any,
  workloadFormData?: any,
): GroupedChanges => {
  return useMemo(() => {
    const grouped: GroupedChanges = {
      component: [],
      traits: {},
    };

    // Calculate component-type changes using shared utility
    grouped.component = deepCompareObjects(
      initialComponentTypeFormData,
      componentTypeFormData,
    );

    // Calculate trait changes for each trait
    const allTraitNames = new Set([
      ...Object.keys(initialTraitFormDataMap),
      ...Object.keys(traitFormDataMap),
    ]);

    allTraitNames.forEach(traitName => {
      const initialData = initialTraitFormDataMap[traitName] || {};
      const currentData = traitFormDataMap[traitName] || {};
      const traitChanges = deepCompareObjects(initialData, currentData);

      if (traitChanges.length > 0) {
        grouped.traits[traitName] = traitChanges;
      }
    });

    // Calculate workload changes if workload data is provided
    if (
      initialWorkloadFormData !== undefined ||
      workloadFormData !== undefined
    ) {
      grouped.workload = deepCompareObjects(
        initialWorkloadFormData || {},
        workloadFormData || {},
      );
    }

    return grouped;
  }, [
    initialComponentTypeFormData,
    componentTypeFormData,
    initialTraitFormDataMap,
    traitFormDataMap,
    initialWorkloadFormData,
    workloadFormData,
  ]);
};
