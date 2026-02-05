import { CatalogProcessor } from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { Entity, stringifyEntityRef } from '@backstage/catalog-model';
import { CHOREO_LABELS } from '@openchoreo/backstage-plugin-common';
import { AnnotationStore } from '../service/AnnotationStore';

/**
 * Processor that merges user-defined custom annotations into catalog entities.
 *
 * Custom annotations are stored in a separate database table (via AnnotationStore)
 * and re-applied during every processing cycle. This ensures annotations survive
 * entity provider full mutations, which replace unprocessed entities entirely.
 */
export class CustomAnnotationProcessor implements CatalogProcessor {
  constructor(private readonly annotationStore: AnnotationStore) {}

  getProcessorName(): string {
    return 'CustomAnnotationProcessor';
  }

  async preProcessEntity(
    entity: Entity,
    _location: LocationSpec,
  ): Promise<Entity> {
    // Only process managed OpenChoreo entities
    if (entity.metadata.labels?.[CHOREO_LABELS.MANAGED] !== 'true') {
      return entity;
    }

    const entityRef = stringifyEntityRef(entity);
    const customAnnotations =
      await this.annotationStore.getAnnotations(entityRef);

    if (Object.keys(customAnnotations).length === 0) {
      return entity;
    }

    // Merge custom annotations into entity.
    // Custom annotations take precedence over provider annotations for the same key.
    return {
      ...entity,
      metadata: {
        ...entity.metadata,
        annotations: {
          ...entity.metadata.annotations,
          ...customAnnotations,
        },
      },
    };
  }
}
