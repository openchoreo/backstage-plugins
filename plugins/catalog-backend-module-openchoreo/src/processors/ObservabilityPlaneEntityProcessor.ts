import {
  CatalogProcessor,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import {
  RELATION_HAS_PART,
  RELATION_PART_OF,
  parseEntityRef,
} from '@backstage/catalog-model';
import { ObservabilityPlaneEntityV1alpha1 } from '../kinds/ObservabilityPlaneEntityV1alpha1';

/**
 * Processor for ObservabilityPlane entities
 */
export class ObservabilityPlaneEntityProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'ObservabilityPlaneEntityProcessor';
  }

  async validateEntityKind(
    entity: ObservabilityPlaneEntityV1alpha1,
  ): Promise<boolean> {
    return entity.kind === 'ObservabilityPlane';
  }

  async postProcessEntity(
    entity: ObservabilityPlaneEntityV1alpha1,
    _location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<ObservabilityPlaneEntityV1alpha1> {
    if (entity.kind === 'ObservabilityPlane') {
      if (!entity.spec?.type) {
        throw new Error('ObservabilityPlane entity must have spec.type');
      }

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
        const domainTarget = {
          kind: domainRef.kind,
          namespace: domainRef.namespace,
          name: domainRef.name,
        };
        emit(
          processingResult.relation({
            source: sourceRef,
            target: domainTarget,
            type: RELATION_PART_OF,
          }),
        );
        emit(
          processingResult.relation({
            source: domainTarget,
            target: sourceRef,
            type: RELATION_HAS_PART,
          }),
        );
      }
    }

    return entity;
  }

  async preProcessEntity(
    entity: ObservabilityPlaneEntityV1alpha1,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<ObservabilityPlaneEntityV1alpha1> {
    if (entity.kind === 'ObservabilityPlane' && entity.spec) {
      if (!entity.spec.type) {
        entity.spec.type = 'kubernetes';
      }
    }

    return entity;
  }

  async processEntity(
    entity: ObservabilityPlaneEntityV1alpha1,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<ObservabilityPlaneEntityV1alpha1> {
    if (entity.kind !== 'ObservabilityPlane') {
      return entity;
    }

    emit(processingResult.entity(location, entity));

    return entity;
  }
}
