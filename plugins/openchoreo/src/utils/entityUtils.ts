import { Entity } from '@backstage/catalog-model';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

export interface EntityMetadata {
  component: string;
  project: string;
  organization: string;
}

/**
 * Extracts OpenChoreo metadata from a Backstage entity.
 * Throws if required annotations are missing.
 *
 * @example
 * const { component, project, organization } = extractEntityMetadata(entity);
 */
export function extractEntityMetadata(entity: Entity): EntityMetadata {
  const component = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];
  const project = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT];
  const organization =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ORGANIZATION];

  if (!component || !project || !organization) {
    throw new Error(
      'Missing required OpenChoreo annotations in entity. ' +
        `Required: ${CHOREO_ANNOTATIONS.COMPONENT}, ${CHOREO_ANNOTATIONS.PROJECT}, ${CHOREO_ANNOTATIONS.ORGANIZATION}`,
    );
  }

  return { component, project, organization };
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
  const organization =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ORGANIZATION];

  if (!component || !project || !organization) {
    return null;
  }

  return { component, project, organization };
}

/**
 * Creates standard query params from entity metadata.
 * Useful for API calls that require component/project/organization params.
 */
export function entityMetadataToParams(
  metadata: EntityMetadata,
): Record<string, string> {
  return {
    componentName: metadata.component,
    projectName: metadata.project,
    organizationName: metadata.organization,
  };
}
