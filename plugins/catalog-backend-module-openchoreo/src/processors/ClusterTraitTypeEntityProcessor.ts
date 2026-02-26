import {
  CatalogProcessor,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { ClusterTraitTypeEntityV1alpha1 } from '../kinds/ClusterTraitTypeEntityV1alpha1';

/**
 * Processor for ClusterTraitType entities.
 * Cluster-scoped: no domain relationships — minimal processor, just validation.
 */
export class ClusterTraitTypeEntityProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'ClusterTraitTypeEntityProcessor';
  }

  async validateEntityKind(
    entity: ClusterTraitTypeEntityV1alpha1,
  ): Promise<boolean> {
    return entity.kind === 'ClusterTraitType';
  }

  async postProcessEntity(
    entity: ClusterTraitTypeEntityV1alpha1,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<ClusterTraitTypeEntityV1alpha1> {
    // No domain relationship — cluster-scoped, shared across all namespaces
    return entity;
  }

  async preProcessEntity(
    entity: ClusterTraitTypeEntityV1alpha1,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<ClusterTraitTypeEntityV1alpha1> {
    return entity;
  }

  async processEntity(
    entity: ClusterTraitTypeEntityV1alpha1,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<ClusterTraitTypeEntityV1alpha1> {
    if (entity.kind !== 'ClusterTraitType') {
      return entity;
    }

    emit(processingResult.entity(location, entity));

    return entity;
  }
}
