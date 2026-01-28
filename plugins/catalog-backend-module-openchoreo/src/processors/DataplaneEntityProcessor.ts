import {
  CatalogProcessor,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { RELATION_PART_OF, parseEntityRef } from '@backstage/catalog-model';
import {
  RELATION_OBSERVED_BY,
  RELATION_OBSERVES,
} from '@openchoreo/backstage-plugin-common';
import { DataplaneEntityV1alpha1 } from '../kinds/DataplaneEntityV1alpha1';

/**
 * Processor for Dataplane entities
 */
export class DataplaneEntityProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'DataplaneEntityProcessor';
  }

  async validateEntityKind(entity: DataplaneEntityV1alpha1): Promise<boolean> {
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

      // Emit relationships based on spec fields
      const sourceRef = {
        kind: entity.kind.toLowerCase(),
        namespace: entity.metadata.namespace || 'default',
        name: entity.metadata.name,
      };

      // Emit partOf relationship to domain
      if (entity.spec.domain) {
        const domainRef = parseEntityRef(entity.spec.domain, {
          defaultKind: 'domain',
          defaultNamespace: entity.metadata.namespace || 'default',
        });
        emit(
          processingResult.relation({
            source: sourceRef,
            target: {
              kind: domainRef.kind,
              namespace: domainRef.namespace,
              name: domainRef.name,
            },
            type: RELATION_PART_OF,
          }),
        );
      }

      // Emit observedBy/observes relationship to observability plane
      // ObservabilityPlanes live in the 'default' namespace unless explicitly specified
      if (entity.spec.observabilityPlaneRef) {
        const obsRef = parseEntityRef(entity.spec.observabilityPlaneRef, {
          defaultKind: 'observabilityplane',
          defaultNamespace: 'default',
        });
        emit(
          processingResult.relation({
            source: sourceRef,
            target: {
              kind: obsRef.kind,
              namespace: obsRef.namespace,
              name: obsRef.name,
            },
            type: RELATION_OBSERVED_BY,
          }),
        );
        emit(
          processingResult.relation({
            source: {
              kind: obsRef.kind,
              namespace: obsRef.namespace,
              name: obsRef.name,
            },
            target: sourceRef,
            type: RELATION_OBSERVES,
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
