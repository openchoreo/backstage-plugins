import { useMemo } from 'react';
import {
  deepCompareObjects,
  type Change,
} from '@openchoreo/backstage-plugin-react';
import type { WorkloadResource } from '@openchoreo/backstage-plugin-common';

/**
 * Workload changes grouped by section
 */
export interface WorkloadChanges {
  /** Changes in container (env vars, files, images, etc.) */
  container: Change[];
  /** Changes in endpoints */
  endpoints: Change[];
  /** Changes in dependencies */
  dependencies: Change[];
  /** Changes in other fields (metadata, owner, etc.) */
  other: Change[];
  /** Total number of changes */
  total: number;
  /** Whether there are any changes */
  hasChanges: boolean;
}

type Dep = {
  project?: string;
  component: string;
  name: string;
  visibility: string;
  envBindings: Record<string, string | undefined>;
};

/**
 * Build a human-readable label for a dependency.
 */
function dependencyLabel(dep: Dep): string {
  const parts: string[] = [];
  if (dep.project) parts.push(dep.project);
  if (dep.component) parts.push(dep.component);
  const target = parts.join('/') || 'unknown';
  return dep.name ? `${target}/${dep.name}` : target;
}

/**
 * Compare dependency arrays and produce changes with readable labels
 * instead of raw array indices.
 */
function compareDependencies(initial: Dep[], current: Dep[]): Change[] {
  const changes: Change[] = [];
  const maxLen = Math.max(initial.length, current.length);

  for (let i = 0; i < maxLen; i++) {
    const oldDep = initial[i];
    const newDep = current[i];

    if (!oldDep && newDep) {
      changes.push({
        path: dependencyLabel(newDep),
        type: 'new',
        newValue: 'Added',
      });
    } else if (oldDep && !newDep) {
      changes.push({
        path: dependencyLabel(oldDep),
        type: 'removed',
        oldValue: 'Removed',
      });
    } else if (oldDep && newDep) {
      const fieldDiffs = deepCompareObjects(oldDep, newDep);
      if (fieldDiffs.length > 0) {
        const label = dependencyLabel(newDep);
        for (const diff of fieldDiffs) {
          changes.push({ ...diff, path: `${label}.${diff.path}` });
        }
      }
    }
  }

  return changes;
}

/** Spec fields that have their own dedicated sections */
const DEDICATED_SPEC_SECTIONS = new Set([
  'container',
  'endpoints',
  'dependencies',
]);

/**
 * Hook for detecting changes between initial and current workload resources.
 * Compares the full K8s resource: spec sections individually + metadata + other fields.
 */
export function useWorkloadChanges(
  initialResource: WorkloadResource | null,
  currentResource: WorkloadResource | null,
): WorkloadChanges {
  return useMemo(() => {
    const initialSpec = initialResource?.spec;
    const currentSpec = currentResource?.spec;

    // Compare container
    const containerChanges = deepCompareObjects(
      initialSpec?.container || {},
      currentSpec?.container || {},
    );

    // Compare endpoints
    const endpointChanges = deepCompareObjects(
      initialSpec?.endpoints || {},
      currentSpec?.endpoints || {},
    );

    // Compare dependencies with human-readable labels
    const dependencyChanges = compareDependencies(
      (initialSpec?.dependencies?.endpoints || []) as Dep[],
      (currentSpec?.dependencies?.endpoints || []) as Dep[],
    );

    // Compare everything else: remaining spec fields + resource-level fields (metadata, etc.)
    const pickOtherSpec = (
      spec: Record<string, unknown> | null | undefined,
    ) => {
      if (!spec) return {};
      const rest: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(spec)) {
        if (!DEDICATED_SPEC_SECTIONS.has(key)) {
          rest[key] = value;
        }
      }
      return rest;
    };

    const pickResourceLevel = (r: WorkloadResource | null) => {
      if (!r) return {};
      // Compare metadata (excluding server-managed fields) and any other top-level fields
      const {
        spec: _spec,
        status: _status,
        apiVersion: _av,
        kind: _k,
        ...rest
      } = r as any;
      return rest;
    };

    const otherSpecChanges = deepCompareObjects(
      pickOtherSpec(initialSpec as any),
      pickOtherSpec(currentSpec as any),
    );
    const metadataChanges = deepCompareObjects(
      pickResourceLevel(initialResource),
      pickResourceLevel(currentResource),
    );
    const otherChanges = [...otherSpecChanges, ...metadataChanges];

    const total =
      containerChanges.length +
      endpointChanges.length +
      dependencyChanges.length +
      otherChanges.length;

    return {
      container: containerChanges,
      endpoints: endpointChanges,
      dependencies: dependencyChanges,
      other: otherChanges,
      total,
      hasChanges: total > 0,
    };
  }, [initialResource, currentResource]);
}
