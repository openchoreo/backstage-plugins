import {
  CatalogProcessor,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { Entity } from '@backstage/catalog-model';
import {
  DeploymentPipelineEntityV1alpha1,
  PromotionPath,
} from '../kinds/DeploymentPipelineEntityV1alpha1';
import {
  RELATION_PROMOTES_TO,
  RELATION_PROMOTED_BY,
  RELATION_USES_PIPELINE,
  RELATION_PIPELINE_USED_BY,
} from '@openchoreo/backstage-plugin-common';

/**
 * Type guard to check if an entity is a DeploymentPipeline
 */
function isDeploymentPipelineEntity(
  entity: Entity,
): entity is DeploymentPipelineEntityV1alpha1 {
  return entity.kind === 'DeploymentPipeline';
}

/**
 * Processor for DeploymentPipeline entities
 */
export class DeploymentPipelineEntityProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'DeploymentPipelineEntityProcessor';
  }

  async validateEntityKind(entity: Entity): Promise<boolean> {
    return entity.kind === 'DeploymentPipeline';
  }

  async postProcessEntity(
    entity: Entity,
    _location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<Entity> {
    if (!isDeploymentPipelineEntity(entity)) {
      return entity;
    }

    // Validate required fields
    if (!entity.spec?.type) {
      throw new Error('DeploymentPipeline entity must have spec.type');
    }

    // Emit relationships based on spec fields
    const sourceRef = {
      kind: entity.kind.toLowerCase(),
      namespace: entity.metadata.namespace || 'default',
      name: entity.metadata.name,
    };

    // Emit usesPipeline/pipelineUsedBy relationship between project and pipeline
    if (entity.spec.projectRef) {
      const systemRef = {
        kind: 'system',
        namespace: entity.spec.namespaceName || 'default',
        name: entity.spec.projectRef,
      };
      // System (Project) usesPipeline DeploymentPipeline
      emit(
        processingResult.relation({
          source: systemRef,
          target: sourceRef,
          type: RELATION_USES_PIPELINE,
        }),
      );
      // DeploymentPipeline pipelineUsedBy System (inverse)
      emit(
        processingResult.relation({
          source: sourceRef,
          target: systemRef,
          type: RELATION_PIPELINE_USED_BY,
        }),
      );
    }

    // Emit promotesTo relationships to all referenced environments
    // We emit both directions so the inverse relation appears on the Environment entity
    if (entity.spec.promotionPaths) {
      const emittedEnvironments = new Set<string>();
      const promotionPaths = entity.spec.promotionPaths as PromotionPath[];

      for (const path of promotionPaths) {
        // Source environment
        if (
          path.sourceEnvironment &&
          !emittedEnvironments.has(path.sourceEnvironment)
        ) {
          const envRef = {
            kind: 'environment',
            namespace: entity.metadata.namespace || 'default',
            name: path.sourceEnvironment,
          };
          // Pipeline promotesTo Environment
          emit(
            processingResult.relation({
              source: sourceRef,
              target: envRef,
              type: RELATION_PROMOTES_TO,
            }),
          );
          // Environment promotedBy Pipeline (inverse)
          emit(
            processingResult.relation({
              source: envRef,
              target: sourceRef,
              type: RELATION_PROMOTED_BY,
            }),
          );
          emittedEnvironments.add(path.sourceEnvironment);
        }

        // Target environments
        for (const target of path.targetEnvironments || []) {
          if (target.name && !emittedEnvironments.has(target.name)) {
            const envRef = {
              kind: 'environment',
              namespace: entity.metadata.namespace || 'default',
              name: target.name,
            };
            // Pipeline promotesTo Environment
            emit(
              processingResult.relation({
                source: sourceRef,
                target: envRef,
                type: RELATION_PROMOTES_TO,
              }),
            );
            // Environment promotedBy Pipeline (inverse)
            emit(
              processingResult.relation({
                source: envRef,
                target: sourceRef,
                type: RELATION_PROMOTED_BY,
              }),
            );
            emittedEnvironments.add(target.name);
          }
        }
      }
    }

    return entity;
  }

  async preProcessEntity(
    entity: Entity,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<Entity> {
    if (!isDeploymentPipelineEntity(entity)) {
      return entity;
    }

    // Set default values if needed
    if (entity.spec) {
      // Set default type if not specified
      if (!entity.spec.type) {
        entity.spec.type = 'promotion-pipeline';
      }
    }

    return entity;
  }
}
