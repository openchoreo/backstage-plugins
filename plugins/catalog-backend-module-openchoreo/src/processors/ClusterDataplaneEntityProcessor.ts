import {
  CatalogProcessor,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { CompoundEntityRef, parseEntityRef } from '@backstage/catalog-model';
import {
  RELATION_OBSERVED_BY,
  RELATION_OBSERVES,
} from '@openchoreo/backstage-plugin-common';
import { ClusterDataplaneEntityV1alpha1 } from '../kinds/ClusterDataplaneEntityV1alpha1';

/**
 * Processor for ClusterDataplane entities.
 * Cluster-scoped: no domain relationships. Emits observedBy/observes to ClusterObservabilityPlane.
 */
export class ClusterDataplaneEntityProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'ClusterDataplaneEntityProcessor';
  }

  async validateEntityKind(
    entity: ClusterDataplaneEntityV1alpha1,
  ): Promise<boolean> {
    return entity.kind === 'ClusterDataplane';
  }

  async postProcessEntity(
    entity: ClusterDataplaneEntityV1alpha1,
    _location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<ClusterDataplaneEntityV1alpha1> {
    if (entity.kind === 'ClusterDataplane') {
      const sourceRef = {
        kind: entity.kind.toLowerCase(),
        namespace: entity.metadata.namespace || 'openchoreo-cluster',
        name: entity.metadata.name,
      };

      // Emit observedBy/observes relationship to cluster observability plane
      if (entity.spec.observabilityPlaneRef) {
        let obsRef: CompoundEntityRef;
        try {
          obsRef = parseEntityRef(entity.spec.observabilityPlaneRef, {
            defaultKind: 'clusterobservabilityplane',
            defaultNamespace: 'openchoreo-cluster',
          });
        } catch {
          // Skip emitting relation for malformed observabilityPlaneRef
          return entity;
        }
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
    entity: ClusterDataplaneEntityV1alpha1,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<ClusterDataplaneEntityV1alpha1> {
    return entity;
  }

  async processEntity(
    entity: ClusterDataplaneEntityV1alpha1,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<ClusterDataplaneEntityV1alpha1> {
    if (entity.kind !== 'ClusterDataplane') {
      return entity;
    }

    emit(processingResult.entity(location, entity));

    return entity;
  }
}
