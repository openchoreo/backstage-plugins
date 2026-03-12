import {
  CatalogProcessor,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { Entity } from '@backstage/catalog-model';
import {
  CHOREO_ANNOTATIONS,
  RELATION_BUILDS_ON,
  RELATION_BUILDS,
} from '@openchoreo/backstage-plugin-common';

/**
 * Processor for System entities that emits buildsOn/builds relations
 * to WorkflowPlane or ClusterWorkflowPlane based on annotations.
 */
export class SystemWorkflowPlaneProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'SystemWorkflowPlaneProcessor';
  }

  async validateEntityKind(entity: Entity): Promise<boolean> {
    return entity.kind === 'System';
  }

  async postProcessEntity(
    entity: Entity,
    _location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<Entity> {
    if (entity.kind !== 'System') {
      return entity;
    }

    const annotations = entity.metadata.annotations || {};
    const workflowPlaneRef =
      annotations[CHOREO_ANNOTATIONS.WORKFLOW_PLANE_REF]?.trim();
    const workflowPlaneRefKind =
      annotations[CHOREO_ANNOTATIONS.WORKFLOW_PLANE_REF_KIND]?.trim();

    if (workflowPlaneRef) {
      const normalizedKind = (
        workflowPlaneRefKind || 'WorkflowPlane'
      ).toLowerCase();
      if (
        normalizedKind !== 'workflowplane' &&
        normalizedKind !== 'clusterworkflowplane'
      ) {
        // Unrecognized workflow plane kind — skip relation
        return entity;
      }
      const isCluster = normalizedKind === 'clusterworkflowplane';
      const targetKind = isCluster ? 'clusterworkflowplane' : 'workflowplane';
      const targetNamespace = isCluster
        ? 'openchoreo-cluster'
        : entity.metadata.namespace || 'default';

      const sourceRef = {
        kind: 'system',
        namespace: entity.metadata.namespace || 'default',
        name: entity.metadata.name,
      };
      const targetRef = {
        kind: targetKind,
        namespace: targetNamespace,
        name: workflowPlaneRef,
      };

      emit(
        processingResult.relation({
          source: sourceRef,
          target: targetRef,
          type: RELATION_BUILDS_ON,
        }),
      );
      emit(
        processingResult.relation({
          source: targetRef,
          target: sourceRef,
          type: RELATION_BUILDS,
        }),
      );
    }

    return entity;
  }
}
