import {
  CatalogProcessor,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { RELATION_PART_OF, parseEntityRef } from '@backstage/catalog-model';
import { TraitTypeEntityV1alpha1 } from '../kinds/TraitTypeEntityV1alpha1';

/**
 * Processor for TraitType entities
 */
export class TraitTypeEntityProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'TraitTypeEntityProcessor';
  }

  async validateEntityKind(entity: TraitTypeEntityV1alpha1): Promise<boolean> {
    return entity.kind === 'TraitType';
  }

  async postProcessEntity(
    entity: TraitTypeEntityV1alpha1,
    _location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<TraitTypeEntityV1alpha1> {
    if (entity.kind === 'TraitType') {
      if (!entity.spec?.type) {
        throw new Error('TraitType entity must have spec.type');
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
    }

    return entity;
  }

  async preProcessEntity(
    entity: TraitTypeEntityV1alpha1,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<TraitTypeEntityV1alpha1> {
    if (entity.kind === 'TraitType' && entity.spec) {
      if (!entity.spec.type) {
        entity.spec.type = 'trait-type';
      }
    }

    return entity;
  }

  async processEntity(
    entity: TraitTypeEntityV1alpha1,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<TraitTypeEntityV1alpha1> {
    if (entity.kind !== 'TraitType') {
      return entity;
    }

    emit(processingResult.entity(location, entity));

    return entity;
  }
}
