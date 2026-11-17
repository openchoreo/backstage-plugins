import {
  CatalogProcessor,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { ClusterEndpointTypeEntityV1alpha1 } from '../kinds/ClusterEndpointTypeEntityV1alpha1';

/**
 * Processor for ClusterEndpointType entities.
 * Cluster-scoped: no domain relationships — minimal processor, just validation.
 */
export class ClusterEndpointTypeEntityProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'ClusterEndpointTypeEntityProcessor';
  }

  async validateEntityKind(
    entity: ClusterEndpointTypeEntityV1alpha1,
  ): Promise<boolean> {
    return entity.kind === 'ClusterEndpointType';
  }

  async postProcessEntity(
    entity: ClusterEndpointTypeEntityV1alpha1,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<ClusterEndpointTypeEntityV1alpha1> {
    // No domain relationship — cluster-scoped, shared across all namespaces
    return entity;
  }

  async preProcessEntity(
    entity: ClusterEndpointTypeEntityV1alpha1,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<ClusterEndpointTypeEntityV1alpha1> {
    return entity;
  }

  async processEntity(
    entity: ClusterEndpointTypeEntityV1alpha1,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<ClusterEndpointTypeEntityV1alpha1> {
    if (entity.kind !== 'ClusterEndpointType') {
      return entity;
    }

    emit(processingResult.entity(location, entity));

    return entity;
  }
}
