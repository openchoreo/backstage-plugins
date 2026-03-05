import {
  CatalogProcessor,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { ClusterObservabilityPlaneEntityV1alpha1 } from '../kinds/ClusterObservabilityPlaneEntityV1alpha1';

/**
 * Processor for ClusterObservabilityPlane entities.
 * Cluster-scoped: no domain relationships. The observedBy/observes relationships
 * are emitted by ClusterDataplaneEntityProcessor and ClusterBuildPlaneEntityProcessor.
 */
export class ClusterObservabilityPlaneEntityProcessor
  implements CatalogProcessor
{
  getProcessorName(): string {
    return 'ClusterObservabilityPlaneEntityProcessor';
  }

  async validateEntityKind(
    entity: ClusterObservabilityPlaneEntityV1alpha1,
  ): Promise<boolean> {
    return entity.kind === 'ClusterObservabilityPlane';
  }

  async postProcessEntity(
    entity: ClusterObservabilityPlaneEntityV1alpha1,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<ClusterObservabilityPlaneEntityV1alpha1> {
    return entity;
  }

  async preProcessEntity(
    entity: ClusterObservabilityPlaneEntityV1alpha1,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<ClusterObservabilityPlaneEntityV1alpha1> {
    return entity;
  }

  async processEntity(
    entity: ClusterObservabilityPlaneEntityV1alpha1,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<ClusterObservabilityPlaneEntityV1alpha1> {
    if (entity.kind !== 'ClusterObservabilityPlane') {
      return entity;
    }

    emit(processingResult.entity(location, entity));

    return entity;
  }
}
