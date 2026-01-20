import { Entity } from '@backstage/catalog-model';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

export interface EntityMetadata {
  component: string;
  project: string;
  namespace: string;
}

/**
 * Extracts OpenChoreo metadata from a Backstage entity.
 * Throws if required annotations are missing.
 *
 * @example
 * const { component, project, namespace } = extractEntityMetadata(entity);
 */
export function extractEntityMetadata(entity: Entity): EntityMetadata {
  const component = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];
  const project = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT];
  const namespace =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];

  if (!component || !project || !namespace) {
    throw new Error(
      'Missing required OpenChoreo annotations in entity. ' +
        `Required: ${CHOREO_ANNOTATIONS.COMPONENT}, ${CHOREO_ANNOTATIONS.PROJECT}, ${CHOREO_ANNOTATIONS.NAMESPACE}`,
    );
  }

  return { component, project, namespace };
}

/**
 * Extracts OpenChoreo metadata from a Backstage entity.
 * Returns null if any required annotation is missing (instead of throwing).
 *
 * @example
 * const metadata = tryExtractEntityMetadata(entity);
 * if (!metadata) {
 *   return []; // Handle missing metadata gracefully
 * }
 */
export function tryExtractEntityMetadata(
  entity: Entity,
): EntityMetadata | null {
  const component = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];
  const project = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT];
  const namespace =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];

  if (!component || !project || !namespace) {
    return null;
  }

  return { component, project, namespace };
}

/**
 * Creates standard query params from entity metadata.
 * Useful for API calls that require component/project/namespace params.
 */
export function entityMetadataToParams(
  metadata: EntityMetadata,
): Record<string, string> {
  return {
    componentName: metadata.component,
    projectName: metadata.project,
    namespaceName: metadata.namespace,
  };
}
