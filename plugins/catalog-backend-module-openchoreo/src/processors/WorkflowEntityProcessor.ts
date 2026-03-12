import {
  CatalogProcessor,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import {
  RELATION_HAS_PART,
  RELATION_PART_OF,
  parseEntityRef,
} from '@backstage/catalog-model';
import {
  CHOREO_ANNOTATIONS,
  RELATION_BUILDS_ON,
  RELATION_BUILDS,
} from '@openchoreo/backstage-plugin-common';
import { WorkflowEntityV1alpha1 } from '../kinds/WorkflowEntityV1alpha1';

/**
 * Processor for Workflow entities
 */
export class WorkflowEntityProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'WorkflowEntityProcessor';
  }

  async validateEntityKind(entity: WorkflowEntityV1alpha1): Promise<boolean> {
    return entity.kind === 'Workflow';
  }

  async postProcessEntity(
    entity: WorkflowEntityV1alpha1,
    _location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<WorkflowEntityV1alpha1> {
    if (entity.kind === 'Workflow') {
      const sourceRef = {
        kind: entity.kind.toLowerCase(),
        namespace: entity.metadata.namespace || 'default',
        name: entity.metadata.name,
      };

      // Emit partOf relationship to domain
      if (entity.spec.domain) {
        const domainRef = parseEntityRef(entity.spec.domain, {
          defaultKind: 'domain',
          defaultNamespace: entity.metadata.namespace || 'default',
        });
        const domainTarget = {
          kind: domainRef.kind,
          namespace: domainRef.namespace,
          name: domainRef.name,
        };
        emit(
          processingResult.relation({
            source: sourceRef,
            target: domainTarget,
            type: RELATION_PART_OF,
          }),
        );
        emit(
          processingResult.relation({
            source: domainTarget,
            target: sourceRef,
            type: RELATION_HAS_PART,
          }),
        );
      }

      // Emit buildsOn/builds relationship to WorkflowPlane or ClusterWorkflowPlane
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
    }

    return entity;
  }

  async preProcessEntity(
    entity: WorkflowEntityV1alpha1,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<WorkflowEntityV1alpha1> {
    return entity;
  }

  async processEntity(
    entity: WorkflowEntityV1alpha1,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<WorkflowEntityV1alpha1> {
    if (entity.kind !== 'Workflow') {
      return entity;
    }

    emit(processingResult.entity(location, entity));

    return entity;
  }
}
