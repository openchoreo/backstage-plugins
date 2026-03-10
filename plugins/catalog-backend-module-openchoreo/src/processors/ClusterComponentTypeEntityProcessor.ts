import {
  CatalogProcessor,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import {
  RELATION_USES_WORKFLOW,
  RELATION_WORKFLOW_USED_BY,
} from '@openchoreo/backstage-plugin-common';
import { ClusterComponentTypeEntityV1alpha1 } from '../kinds/ClusterComponentTypeEntityV1alpha1';

/**
 * Processor for ClusterComponentType entities.
 * Cluster-scoped: no domain relationships, but emits workflow relationships.
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
    emit: CatalogProcessorEmit,
  ): Promise<ClusterComponentTypeEntityV1alpha1> {
    if (entity.kind === 'ClusterComponentType') {
      const sourceRef = {
        kind: entity.kind.toLowerCase(),
        namespace: entity.metadata.namespace || 'openchoreo-cluster',
        name: entity.metadata.name,
      };

      // Emit usesWorkflow/workflowUsedBy relationships for each allowed workflow
      if (entity.spec.allowedWorkflows) {
        for (const workflow of entity.spec.allowedWorkflows) {
          const workflowName =
            typeof workflow === 'string' ? workflow : workflow.name;
          if (!workflowName) continue;
          const workflowKind =
            typeof workflow === 'string'
              ? 'clusterworkflow'
              : (workflow.kind || 'ClusterWorkflow').toLowerCase();
          const wfRef = {
            kind: workflowKind,
            namespace: 'openchoreo-cluster',
            name: workflowName,
          };
          emit(
            processingResult.relation({
              source: sourceRef,
              target: wfRef,
              type: RELATION_USES_WORKFLOW,
            }),
          );
          emit(
            processingResult.relation({
              source: wfRef,
              target: sourceRef,
              type: RELATION_WORKFLOW_USED_BY,
            }),
          );
        }
      }
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
