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
import { EndpointTypeEntityV1alpha1 } from '../kinds/EndpointTypeEntityV1alpha1';

/**
 * Processor for EndpointType entities.
 * Namespaced: emits partOf Domain relation, mirroring TraitTypeEntityProcessor.
 */
export class EndpointTypeEntityProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'EndpointTypeEntityProcessor';
  }

  async validateEntityKind(
    entity: EndpointTypeEntityV1alpha1,
  ): Promise<boolean> {
    return entity.kind === 'EndpointType';
  }

  async postProcessEntity(
    entity: EndpointTypeEntityV1alpha1,
    _location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<EndpointTypeEntityV1alpha1> {
    if (entity.kind === 'EndpointType') {
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
    entity: EndpointTypeEntityV1alpha1,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<EndpointTypeEntityV1alpha1> {
    return entity;
  }

  async processEntity(
    entity: EndpointTypeEntityV1alpha1,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<EndpointTypeEntityV1alpha1> {
    if (entity.kind !== 'EndpointType') {
      return entity;
    }

    emit(processingResult.entity(location, entity));

    return entity;
  }
}
