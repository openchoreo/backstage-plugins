import {
  CatalogProcessor,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { ClusterProjectTypeEntityV1alpha1 } from '../kinds/ClusterProjectTypeEntityV1alpha1';

/**
 * Processor for ClusterProjectType entities.
 * Cluster-scoped: no domain relationships — minimal processor, just validation.
 */
export class ClusterProjectTypeEntityProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'ClusterProjectTypeEntityProcessor';
  }

  async validateEntityKind(
    entity: ClusterProjectTypeEntityV1alpha1,
  ): Promise<boolean> {
    return entity.kind === 'ClusterProjectType';
  }

  async postProcessEntity(
    entity: ClusterProjectTypeEntityV1alpha1,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<ClusterProjectTypeEntityV1alpha1> {
    // No domain relationship — cluster-scoped, shared across all namespaces
    return entity;
  }

  async preProcessEntity(
    entity: ClusterProjectTypeEntityV1alpha1,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<ClusterProjectTypeEntityV1alpha1> {
    return entity;
  }

  async processEntity(
    entity: ClusterProjectTypeEntityV1alpha1,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<ClusterProjectTypeEntityV1alpha1> {
    if (entity.kind !== 'ClusterProjectType') {
      return entity;
    }

    emit(processingResult.entity(location, entity));

    return entity;
  }
}
