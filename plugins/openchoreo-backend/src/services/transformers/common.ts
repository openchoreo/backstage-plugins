/**
 * Shared helpers for transforming K8s-style resources to legacy response shapes.
 *
 * Re-exports the resource-utils from openchoreo-client-node and adds
 * helpers specific to the BFF transformer layer.
 */

import {
  getName,
  getNamespace,
  getUid,
  getCreatedAt,
  getDisplayName,
  getDescription,
  getConditionStatus,
  type OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';

// Re-export for convenience so transformers only need to import from ./common
export {
  getName,
  getNamespace,
  getUid,
  getCreatedAt,
  getDisplayName,
  getDescription,
  getConditionStatus,
};

type Condition = OpenChoreoComponents['schemas']['Condition'];

/** Any resource whose status may contain K8s-style conditions. */
interface HasConditions {
  status?: {
    conditions?: Condition[];
  };
}

/**
 * Derives a single status string from K8s conditions.
 *
 * Convention: if a `Ready` condition exists, use its `status` field
 * mapped to a human-readable value. Otherwise return `undefined`.
 */
export function deriveStatus(resource: HasConditions): string | undefined {
  const readyStatus = getConditionStatus(resource, 'Ready');
  if (!readyStatus) return undefined;
  switch (readyStatus) {
    case 'True':
      return 'Ready';
    case 'False':
      return 'Error';
    case 'Unknown':
      return 'Pending';
    default:
      return undefined;
  }
}
