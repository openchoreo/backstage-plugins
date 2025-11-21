import { useMemo } from 'react';

export interface Change {
  path: string;
  type: 'new' | 'modified' | 'removed';
  oldValue?: any;
  newValue?: any;
}

export interface GroupedChanges {
  component: Change[];
  traits: Record<string, Change[]>;
}

/**
 * Custom hook to calculate changes between initial and current override data
 * @param initialComponentTypeFormData - Initial component-type override data
 * @param componentTypeFormData - Current component-type override data
 * @param initialTraitFormDataMap - Initial trait overrides data (trait name -> data)
 * @param traitFormDataMap - Current trait overrides data (trait name -> data)
 * @returns Grouped changes organized by component and traits
 */
export const useOverrideChanges = (
  initialComponentTypeFormData: any,
  componentTypeFormData: any,
  initialTraitFormDataMap: Record<string, any>,
  traitFormDataMap: Record<string, any>,
): GroupedChanges => {
  return useMemo(() => {
    const grouped: GroupedChanges = {
      component: [],
      traits: {},
    };

    const traverse = (obj1: any, obj2: any, path: string = ''): Change[] => {
      const allKeys = new Set([
        ...Object.keys(obj1 || {}),
        ...Object.keys(obj2 || {}),
      ]);

      const changes: Change[] = [];

      allKeys.forEach(key => {
        const currentPath = path ? `${path}.${key}` : key;
        const val1 = obj1?.[key];
        const val2 = obj2?.[key];

        if (val1 === undefined && val2 !== undefined) {
          changes.push({
            path: currentPath,
            type: 'new',
            newValue: val2,
          });
        } else if (val1 !== undefined && val2 === undefined) {
          changes.push({
            path: currentPath,
            type: 'removed',
            oldValue: val1,
          });
        } else if (
          typeof val1 === 'object' &&
          val1 !== null &&
          typeof val2 === 'object' &&
          val2 !== null &&
          !Array.isArray(val1) &&
          !Array.isArray(val2)
        ) {
          // Recurse for nested objects
          changes.push(...traverse(val1, val2, currentPath));
        } else if (JSON.stringify(val1) !== JSON.stringify(val2)) {
          changes.push({
            path: currentPath,
            type: 'modified',
            oldValue: val1,
            newValue: val2,
          });
        }
      });

      return changes;
    };

    // Calculate component-type changes
    grouped.component = traverse(
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
      const traitChanges = traverse(initialData, currentData);

      if (traitChanges.length > 0) {
        grouped.traits[traitName] = traitChanges;
      }
    });

    return grouped;
  }, [
    initialComponentTypeFormData,
    componentTypeFormData,
    initialTraitFormDataMap,
    traitFormDataMap,
  ]);
};
