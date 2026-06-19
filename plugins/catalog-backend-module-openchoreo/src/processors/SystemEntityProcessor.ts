import {
  CatalogProcessor,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { Entity } from '@backstage/catalog-model';
import {
  CHOREO_ANNOTATIONS,
  RELATION_USES_PIPELINE,
  RELATION_PIPELINE_USED_BY,
  RELATION_INSTANCE_OF,
  RELATION_HAS_INSTANCE,
} from '@openchoreo/backstage-plugin-common';

/**
 * Processor for OpenChoreo-managed System entities (i.e. Backstage Systems
 * that represent OpenChoreo Projects).
 *
 * Emits the `usesPipeline` / `pipelineUsedBy` relation pair from the
 * Project side, based on `spec.deploymentPipelineRef` on the System
 * entity. This replaces the previous design where the same relations
 * were emitted from `DeploymentPipeline.spec.projectRefs` — the
 * inverted-index field has been removed because it caused stale
 * relations whenever a Project's pipeline reference changed (the old
 * pipeline kept claiming the project until the next periodic poll).
 *
 * With the foreign key on the Project, re-processing the System after
 * an event-driven update naturally produces the new relations and
 * discards the old ones.
 */
export class SystemEntityProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'OpenChoreoSystemEntityProcessor';
  }

  async postProcessEntity(
    entity: Entity,
    _location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<Entity> {
    if (entity.kind !== 'System') {
      return entity;
    }

    const systemRef = {
      kind: 'system',
      namespace: entity.metadata.namespace ?? 'default',
      name: entity.metadata.name,
    };

    const pipelineName = (entity.spec as { deploymentPipelineRef?: string })
      ?.deploymentPipelineRef;
    if (pipelineName) {
      const pipelineRef = {
        kind: 'deploymentpipeline',
        namespace: entity.metadata.namespace ?? 'default',
        name: pipelineName,
      };

      // System (Project) usesPipeline DeploymentPipeline
      emit(
        processingResult.relation({
          source: systemRef,
          target: pipelineRef,
          type: RELATION_USES_PIPELINE,
        }),
      );
      // DeploymentPipeline pipelineUsedBy System (inverse)
      emit(
        processingResult.relation({
          source: pipelineRef,
          target: systemRef,
          type: RELATION_PIPELINE_USED_BY,
        }),
      );
    }

    // System (Project) instanceOf (Cluster)ProjectType. The bare type name
    // lives in the `openchoreo.io/project-type` annotation; the kind
    // disambiguation (ProjectType vs ClusterProjectType) in
    // `openchoreo.io/project-type-kind`. Mirrors ResourceEntityProcessor's
    // Resource → (Cluster)ResourceType wiring. Cluster-scoped types live in
    // the synthetic `openchoreo-cluster` namespace.
    const projectTypeName =
      entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT_TYPE];
    if (projectTypeName) {
      const projectTypeKind =
        entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT_TYPE_KIND];
      const isClusterPT = projectTypeKind === 'ClusterProjectType';
      const ptRef = {
        kind: isClusterPT ? 'clusterprojecttype' : 'projecttype',
        namespace: isClusterPT
          ? 'openchoreo-cluster'
          : entity.metadata.namespace ?? 'default',
        name: projectTypeName,
      };

      emit(
        processingResult.relation({
          source: systemRef,
          target: ptRef,
          type: RELATION_INSTANCE_OF,
        }),
      );
      emit(
        processingResult.relation({
          source: ptRef,
          target: systemRef,
          type: RELATION_HAS_INSTANCE,
        }),
      );
    }

    return entity;
  }
}
