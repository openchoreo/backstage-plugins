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
import { ClusterBuildPlaneEntityV1alpha1 } from '../kinds/ClusterBuildPlaneEntityV1alpha1';

/**
 * Processor for ClusterBuildPlane entities.
 * Cluster-scoped: no domain relationships. Emits observedBy/observes to ClusterObservabilityPlane.
 */
export class ClusterBuildPlaneEntityProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'ClusterBuildPlaneEntityProcessor';
  }

  async validateEntityKind(
    entity: ClusterBuildPlaneEntityV1alpha1,
  ): Promise<boolean> {
    return entity.kind === 'ClusterBuildPlane';
  }

  async postProcessEntity(
    entity: ClusterBuildPlaneEntityV1alpha1,
    _location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<ClusterBuildPlaneEntityV1alpha1> {
    if (entity.kind === 'ClusterBuildPlane') {
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
    entity: ClusterBuildPlaneEntityV1alpha1,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<ClusterBuildPlaneEntityV1alpha1> {
    return entity;
  }

  async processEntity(
    entity: ClusterBuildPlaneEntityV1alpha1,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<ClusterBuildPlaneEntityV1alpha1> {
    if (entity.kind !== 'ClusterBuildPlane') {
      return entity;
    }

    emit(processingResult.entity(location, entity));

    return entity;
  }
}
