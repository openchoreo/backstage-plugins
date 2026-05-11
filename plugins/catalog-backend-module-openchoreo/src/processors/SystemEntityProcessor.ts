import {
  CatalogProcessor,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { Entity } from '@backstage/catalog-model';
import {
  RELATION_USES_PIPELINE,
  RELATION_PIPELINE_USED_BY,
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

    const pipelineName = (entity.spec as { deploymentPipelineRef?: string })
      ?.deploymentPipelineRef;
    if (!pipelineName) {
      return entity;
    }

    const systemRef = {
      kind: 'system',
      namespace: entity.metadata.namespace ?? 'default',
      name: entity.metadata.name,
    };
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

    return entity;
  }
}
