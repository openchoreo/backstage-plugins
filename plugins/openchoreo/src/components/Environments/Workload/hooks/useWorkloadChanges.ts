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

type ResourceDep = {
  ref: string;
  envBindings?: Record<string, string | undefined>;
  fileBindings?: Record<string, string | undefined>;
};

/**
 * Build a human-readable label for an endpoint dependency.
 */
function dependencyLabel(dep: Dep): string {
  const parts: string[] = [];
  if (dep.project) parts.push(dep.project);
  if (dep.component) parts.push(dep.component);
  const target = parts.join('/') || 'unknown';
  return dep.name ? `${target}/${dep.name}` : target;
}

/**
 * Build a human-readable label for a resource dependency. The ref is the
 * developer's primary handle for the binding so the label is just the ref.
 */
function resourceDependencyLabel(dep: ResourceDep): string {
  return dep.ref || 'unknown';
}

/**
 * Walk two arrays in order and emit add/remove/modify changes, deriving
 * each change's path from a caller-supplied label function so the user
 * sees `payments-svc/orders` or `orders-db` instead of `[0]`.
 */
function diffNamedArray<T>(
  initial: T[],
  current: T[],
  label: (item: T) => string,
): Change[] {
  const changes: Change[] = [];
  const maxLen = Math.max(initial.length, current.length);

  for (let i = 0; i < maxLen; i++) {
    const oldItem = initial[i];
    const newItem = current[i];

    if (!oldItem && newItem) {
      changes.push({
        path: label(newItem),
        type: 'new',
        newValue: 'Added',
      });
    } else if (oldItem && !newItem) {
      changes.push({
        path: label(oldItem),
        type: 'removed',
        oldValue: 'Removed',
      });
    } else if (oldItem && newItem) {
      const fieldDiffs = deepCompareObjects(
        oldItem as unknown as Record<string, unknown>,
        newItem as unknown as Record<string, unknown>,
      );
      if (fieldDiffs.length > 0) {
        const path = label(newItem);
        for (const diff of fieldDiffs) {
          changes.push({ ...diff, path: `${path}.${diff.path}` });
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

    // Compare dependencies with human-readable labels. Endpoint and resource
    // deps live as siblings under spec.dependencies; both sides need to flip
    // dirty state so callers (save buttons, unsaved-changes prompts) see them.
    const endpointDependencyChanges = diffNamedArray(
      (initialSpec?.dependencies?.endpoints || []) as Dep[],
      (currentSpec?.dependencies?.endpoints || []) as Dep[],
      dependencyLabel,
    );
    const resourceDependencyChanges = diffNamedArray(
      (initialSpec?.dependencies?.resources || []) as ResourceDep[],
      (currentSpec?.dependencies?.resources || []) as ResourceDep[],
      resourceDependencyLabel,
    );
    const dependencyChanges = [
      ...endpointDependencyChanges,
      ...resourceDependencyChanges,
    ];

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
