/**
 * Utility functions for working with K8s-style OpenChoreo resources.
 *
 * These helpers extract fields from resources that follow the
 * `{ metadata: ObjectMeta, spec: ..., status: ... }` pattern used
 * by the new OpenChoreo API.
 *
 * @packageDocumentation
 */

import type { components } from './generated/openchoreo/types';

type ObjectMeta = components['schemas']['ObjectMeta'];
type Condition = components['schemas']['Condition'];

/** Any object that carries K8s-style metadata. */
interface HasMetadata {
  metadata?: ObjectMeta;
}

/** Any object whose status may contain conditions. */
interface HasConditions {
  status?: {
    conditions?: Condition[];
  };
}

// ---------------------------------------------------------------------------
// Metadata accessors
// ---------------------------------------------------------------------------

export function getName(resource: HasMetadata): string | undefined {
  return resource.metadata?.name;
}

export function getNamespace(resource: HasMetadata): string | undefined {
  return resource.metadata?.namespace;
}

export function getUid(resource: HasMetadata): string | undefined {
  return resource.metadata?.uid;
}

export function getCreatedAt(resource: HasMetadata): string | undefined {
  return resource.metadata?.creationTimestamp;
}

export function getLabels(
  resource: HasMetadata,
): Record<string, string> | undefined {
  return resource.metadata?.labels;
}

export function getAnnotations(
  resource: HasMetadata,
): Record<string, string> | undefined {
  return resource.metadata?.annotations;
}

export function getLabel(
  resource: HasMetadata,
  key: string,
): string | undefined {
  return resource.metadata?.labels?.[key];
}

export function getAnnotation(
  resource: HasMetadata,
  key: string,
): string | undefined {
  return resource.metadata?.annotations?.[key];
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/**
 * Returns the human-readable display name for a resource.
 * Checks annotation `openchoreo.dev/display-name`, then falls back to the
 * resource name.
 */
export function getDisplayName(resource: HasMetadata): string | undefined {
  return getAnnotation(resource, 'openchoreo.dev/display-name') ?? '';
}

/**
 * Returns the description for a resource.
 * Checks annotation `openchoreo.dev/description`.
 */
export function getDescription(resource: HasMetadata): string | undefined {
  return getAnnotation(resource, 'openchoreo.dev/description');
}

// ---------------------------------------------------------------------------
// Condition helpers
// ---------------------------------------------------------------------------

export function getConditions(
  resource: HasConditions,
): Condition[] | undefined {
  return resource.status?.conditions;
}

export function getCondition(
  resource: HasConditions,
  type: string,
): Condition | undefined {
  return resource.status?.conditions?.find(c => c.type === type);
}

export function getConditionStatus(
  resource: HasConditions,
  type: string,
): 'True' | 'False' | 'Unknown' | undefined {
  return getCondition(resource, type)?.status;
}

/**
 * Returns true if the resource has a `Ready` condition with status `True`.
 */
export function isReady(resource: HasConditions): boolean {
  return getConditionStatus(resource, 'Ready') === 'True';
}
