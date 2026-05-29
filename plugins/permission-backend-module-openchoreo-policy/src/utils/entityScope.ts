import type { Entity } from '@backstage/catalog-model';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

export interface EntityScope {
  namespace?: string;
  project?: string;
  component?: string;
}

/**
 * Extracts the OpenChoreo capability scope (namespace/project/component) from
 * a catalog entity's annotations. System entities use the PROJECT_ID
 * annotation, other kinds use PROJECT — matching the convention in the
 * matchesCapability rule.
 */
export function getEntityScope(entity: Entity): EntityScope {
  const namespace = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];
  const project =
    entity.kind.toLowerCase() === 'system'
      ? entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT_ID]
      : entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT];
  const component = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];
  return { namespace, project, component };
}

/**
 * Builds a capability path from raw scope fields. Used when there is no
 * catalog entity to derive scope from — e.g. the scaffolder form supplies
 * `{namespace, project}` before the component is created.
 */
export function scopeToCapabilityPath(
  namespace: string,
  project?: string,
  component?: string,
): string {
  let path = `ns/${namespace}`;
  if (project) path += `/project/${project}`;
  if (component) path += `/component/${component}`;
  return path;
}

/**
 * Builds the OpenChoreo capability path for a catalog entity, e.g.
 * `ns/acme/project/payments/component/api`. Returns `undefined` when the
 * entity is missing the namespace annotation (no capability check possible).
 */
export function entityToCapabilityPath(entity: Entity): string | undefined {
  const { namespace, project, component } = getEntityScope(entity);
  if (!namespace) return undefined;
  return scopeToCapabilityPath(namespace, project, component);
}
