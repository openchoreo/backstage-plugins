import {
  CatalogProcessor,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { ClusterComponentTypeEntityV1alpha1 } from '../kinds/ClusterComponentTypeEntityV1alpha1';

/**
 * Processor for ClusterComponentType entities.
 * Cluster-scoped: no domain relationships.
 */
export class ClusterComponentTypeEntityProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'ClusterComponentTypeEntityProcessor';
  }

  async validateEntityKind(
    entity: ClusterComponentTypeEntityV1alpha1,
  ): Promise<boolean> {
    return entity.kind === 'ClusterComponentType';
  }

  async postProcessEntity(
    entity: ClusterComponentTypeEntityV1alpha1,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<ClusterComponentTypeEntityV1alpha1> {
    if (entity.kind === 'ClusterComponentType') {
      // No domain relationship — cluster-scoped, shared across all namespaces
      // Component workflows are namespace-scoped; avoid emitting dangling relations.
    }

    return entity;
  }

  async preProcessEntity(
    entity: ClusterComponentTypeEntityV1alpha1,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<ClusterComponentTypeEntityV1alpha1> {
    return entity;
  }

  async processEntity(
    entity: ClusterComponentTypeEntityV1alpha1,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<ClusterComponentTypeEntityV1alpha1> {
    if (entity.kind !== 'ClusterComponentType') {
      return entity;
    }

    emit(processingResult.entity(location, entity));

    return entity;
  }
}
