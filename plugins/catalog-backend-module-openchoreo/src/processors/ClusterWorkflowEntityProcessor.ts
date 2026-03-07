import {
  CatalogProcessor,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { ClusterWorkflowEntityV1alpha1 } from '../kinds/ClusterWorkflowEntityV1alpha1';

/**
 * Processor for ClusterWorkflow entities
 */
export class ClusterWorkflowEntityProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'ClusterWorkflowEntityProcessor';
  }

  async validateEntityKind(
    entity: ClusterWorkflowEntityV1alpha1,
  ): Promise<boolean> {
    return entity.kind === 'ClusterWorkflow';
  }

  async postProcessEntity(
    entity: ClusterWorkflowEntityV1alpha1,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<ClusterWorkflowEntityV1alpha1> {
    // No domain relationship for cluster-scoped entities
    return entity;
  }

  async preProcessEntity(
    entity: ClusterWorkflowEntityV1alpha1,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<ClusterWorkflowEntityV1alpha1> {
    return entity;
  }

  async processEntity(
    entity: ClusterWorkflowEntityV1alpha1,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<ClusterWorkflowEntityV1alpha1> {
    if (entity.kind !== 'ClusterWorkflow') {
      return entity;
    }

    emit(processingResult.entity(location, entity));

    return entity;
  }
}
