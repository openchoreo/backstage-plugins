import {
  CatalogProcessor,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { ClusterHookEntityV1alpha1 } from '../kinds/ClusterHookEntityV1alpha1';
import { emitHookWorkflowRelation } from './hookRelations';

/**
 * Processor for ClusterHook entities (deployment hooks, alpha).
 * Cluster-scoped: no domain relationship; emits usesWorkflow → ClusterWorkflow.
 */
export class ClusterHookEntityProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'ClusterHookEntityProcessor';
  }

  async validateEntityKind(
    entity: ClusterHookEntityV1alpha1,
  ): Promise<boolean> {
    return entity.kind === 'ClusterHook';
  }

  async postProcessEntity(
    entity: ClusterHookEntityV1alpha1,
    _location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<ClusterHookEntityV1alpha1> {
    if (entity.kind !== 'ClusterHook') {
      return entity;
    }
    // No domain relationship — cluster-scoped, shared across all namespaces
    const sourceRef = {
      kind: entity.kind.toLowerCase(),
      namespace: entity.metadata.namespace || 'openchoreo-cluster',
      name: entity.metadata.name,
    };
    emitHookWorkflowRelation(sourceRef, entity.spec.workflowRef, emit);
    return entity;
  }

  async preProcessEntity(
    entity: ClusterHookEntityV1alpha1,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<ClusterHookEntityV1alpha1> {
    return entity;
  }

  async processEntity(
    entity: ClusterHookEntityV1alpha1,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<ClusterHookEntityV1alpha1> {
    if (entity.kind !== 'ClusterHook') {
      return entity;
    }

    emit(processingResult.entity(location, entity));

    return entity;
  }
}
