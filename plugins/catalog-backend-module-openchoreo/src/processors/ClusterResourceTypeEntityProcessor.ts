import {
  CatalogProcessor,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { ClusterResourceTypeEntityV1alpha1 } from '../kinds/ClusterResourceTypeEntityV1alpha1';

/**
 * Processor for ClusterResourceType entities.
 * Cluster-scoped: no domain relationships — minimal processor, just validation.
 */
export class ClusterResourceTypeEntityProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'ClusterResourceTypeEntityProcessor';
  }

  async validateEntityKind(
    entity: ClusterResourceTypeEntityV1alpha1,
  ): Promise<boolean> {
    return entity.kind === 'ClusterResourceType';
  }

  async postProcessEntity(
    entity: ClusterResourceTypeEntityV1alpha1,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<ClusterResourceTypeEntityV1alpha1> {
    // No domain relationship — cluster-scoped, shared across all namespaces
    return entity;
  }

  async preProcessEntity(
    entity: ClusterResourceTypeEntityV1alpha1,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<ClusterResourceTypeEntityV1alpha1> {
    return entity;
  }

  async processEntity(
    entity: ClusterResourceTypeEntityV1alpha1,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<ClusterResourceTypeEntityV1alpha1> {
    if (entity.kind !== 'ClusterResourceType') {
      return entity;
    }

    emit(processingResult.entity(location, entity));

    return entity;
  }
}
