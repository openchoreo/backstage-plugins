import {
  CatalogProcessor,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { RELATION_OWNED_BY, RELATION_PART_OF } from '@backstage/catalog-model';
import { DataplaneEntityV1alpha1 } from '../kinds/DataplaneEntityV1alpha1';

/**
 * Processor for Dataplane entities
 */
export class DataplaneEntityProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'DataplaneEntityProcessor';
  }

  async validateEntityKind(
    entity: DataplaneEntityV1alpha1,
  ): Promise<boolean> {
    return entity.kind === 'Dataplane';
  }

  async postProcessEntity(
    entity: DataplaneEntityV1alpha1,
    _location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<DataplaneEntityV1alpha1> {
    // Validate required fields
    if (entity.kind === 'Dataplane') {
      if (!entity.spec?.type) {
        throw new Error('Dataplane entity must have spec.type');
      }
      if (!entity.spec?.owner) {
        throw new Error('Dataplane entity must have spec.owner');
      }

      // Emit relationships based on spec fields
      const sourceRef = {
        kind: entity.kind.toLowerCase(),
        namespace: entity.metadata.namespace || 'default',
        name: entity.metadata.name,
      };

      // Emit partOf relationship to domain
      if (entity.spec.domain) {
        emit(
          processingResult.relation({
            source: sourceRef,
            target: {
              kind: 'domain',
              namespace: 'default',
              name: entity.spec.domain,
            },
            type: RELATION_PART_OF,
          }),
        );
      }

      // Emit ownedBy relationship to owner
      if (entity.spec.owner) {
        emit(
          processingResult.relation({
            source: sourceRef,
            target: {
              kind: 'group',
              namespace: 'default',
              name: entity.spec.owner,
            },
            type: RELATION_OWNED_BY,
          }),
        );
      }
    }

    return entity;
  }

  async preProcessEntity(
    entity: DataplaneEntityV1alpha1,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<DataplaneEntityV1alpha1> {
    // Set default values if needed
    if (entity.kind === 'Dataplane' && entity.spec) {
      // Set default type if not specified
      if (!entity.spec.type) {
        entity.spec.type = 'kubernetes';
      }
    }

    return entity;
  }

  async processEntity(
    entity: DataplaneEntityV1alpha1,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<DataplaneEntityV1alpha1> {
    // Only process Dataplane entities
    if (entity.kind !== 'Dataplane') {
      return entity;
    }

    // Emit the processed entity
    emit(processingResult.entity(location, entity));

    return entity;
  }
}
