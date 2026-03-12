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
import { ClusterWorkflowPlaneEntityV1alpha1 } from '../kinds/ClusterWorkflowPlaneEntityV1alpha1';

/**
 * Processor for ClusterWorkflowPlane entities.
 * Cluster-scoped: no domain relationships. Emits observedBy/observes to ClusterObservabilityPlane.
 */
export class ClusterWorkflowPlaneEntityProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'ClusterWorkflowPlaneEntityProcessor';
  }

  async validateEntityKind(
    entity: ClusterWorkflowPlaneEntityV1alpha1,
  ): Promise<boolean> {
    return entity.kind === 'ClusterWorkflowPlane';
  }

  async postProcessEntity(
    entity: ClusterWorkflowPlaneEntityV1alpha1,
    _location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<ClusterWorkflowPlaneEntityV1alpha1> {
    if (entity.kind === 'ClusterWorkflowPlane') {
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
    entity: ClusterWorkflowPlaneEntityV1alpha1,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<ClusterWorkflowPlaneEntityV1alpha1> {
    return entity;
  }

  async processEntity(
    entity: ClusterWorkflowPlaneEntityV1alpha1,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<ClusterWorkflowPlaneEntityV1alpha1> {
    if (entity.kind !== 'ClusterWorkflowPlane') {
      return entity;
    }

    emit(processingResult.entity(location, entity));

    return entity;
  }
}
