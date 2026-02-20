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
import {
  RELATION_OBSERVED_BY,
  RELATION_OBSERVES,
} from '@openchoreo/backstage-plugin-common';
import { BuildPlaneEntityV1alpha1 } from '../kinds/BuildPlaneEntityV1alpha1';

/**
 * Processor for BuildPlane entities
 */
export class BuildPlaneEntityProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'BuildPlaneEntityProcessor';
  }

  async validateEntityKind(entity: BuildPlaneEntityV1alpha1): Promise<boolean> {
    return entity.kind === 'BuildPlane';
  }

  async postProcessEntity(
    entity: BuildPlaneEntityV1alpha1,
    _location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<BuildPlaneEntityV1alpha1> {
    if (entity.kind === 'BuildPlane') {
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

      // Emit observedBy/observes relationship to observability plane
      if (entity.spec.observabilityPlaneRef) {
        const obsRef = parseEntityRef(entity.spec.observabilityPlaneRef, {
          defaultKind: 'observabilityplane',
          defaultNamespace: entity.metadata.namespace || 'default',
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
    entity: BuildPlaneEntityV1alpha1,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<BuildPlaneEntityV1alpha1> {
    return entity;
  }

  async processEntity(
    entity: BuildPlaneEntityV1alpha1,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<BuildPlaneEntityV1alpha1> {
    if (entity.kind !== 'BuildPlane') {
      return entity;
    }

    emit(processingResult.entity(location, entity));

    return entity;
  }
}
