import {
  CatalogProcessor,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import {
  CHOREO_ANNOTATIONS,
  RELATION_BUILDS_ON,
  RELATION_BUILDS,
} from '@openchoreo/backstage-plugin-common';
import { ClusterWorkflowEntityV1alpha1 } from '../kinds/ClusterWorkflowEntityV1alpha1';

const CLUSTER_NAMESPACE = 'openchoreo-cluster';

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
    emit: CatalogProcessorEmit,
  ): Promise<ClusterWorkflowEntityV1alpha1> {
    if (entity.kind === 'ClusterWorkflow') {
      // Emit buildsOn/builds relationship to ClusterWorkflowPlane
      const annotations = entity.metadata.annotations || {};
      const workflowPlaneRef =
        annotations[CHOREO_ANNOTATIONS.WORKFLOW_PLANE_REF]?.trim();

      if (workflowPlaneRef) {
        const sourceRef = {
          kind: 'clusterworkflow',
          namespace: CLUSTER_NAMESPACE,
          name: entity.metadata.name,
        };
        const targetRef = {
          kind: 'clusterworkflowplane',
          namespace: CLUSTER_NAMESPACE,
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
    }

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
