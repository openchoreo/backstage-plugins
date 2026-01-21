import {
  CatalogProcessor,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import {
  Entity,
  RELATION_OWNED_BY,
  RELATION_PART_OF,
  RELATION_DEPENDS_ON,
} from '@backstage/catalog-model';
import {
  DeploymentPipelineEntityV1alpha1,
  PromotionPath,
} from '../kinds/DeploymentPipelineEntityV1alpha1';

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
    if (!entity.spec?.owner) {
      throw new Error('DeploymentPipeline entity must have spec.owner');
    }

    // Emit relationships based on spec fields
    const sourceRef = {
      kind: entity.kind.toLowerCase(),
      namespace: entity.metadata.namespace || 'default',
      name: entity.metadata.name,
    };

    // Emit partOf relationship to project/system
    if (entity.spec.projectRef) {
      emit(
        processingResult.relation({
          source: sourceRef,
          target: {
            kind: 'system',
            namespace: entity.spec.organization || 'default',
            name: entity.spec.projectRef,
          },
          type: RELATION_PART_OF,
        }),
      );
    }

    // Emit ownedBy relationship to owner
    if (entity.spec.owner) {
      emit(
        processingResult.relation({
          source: sourceRef,
          target: {
            kind: 'group',
            namespace: 'default',
            name: entity.spec.owner,
          },
          type: RELATION_OWNED_BY,
        }),
      );
    }

    // Emit dependsOn relationships to all referenced environments
    if (entity.spec.promotionPaths) {
      const emittedEnvironments = new Set<string>();
      const promotionPaths = entity.spec.promotionPaths as PromotionPath[];

      for (const path of promotionPaths) {
        // Source environment
        if (
          path.sourceEnvironment &&
          !emittedEnvironments.has(path.sourceEnvironment)
        ) {
          emit(
            processingResult.relation({
              source: sourceRef,
              target: {
                kind: 'environment',
                namespace: 'default',
                name: path.sourceEnvironment,
              },
              type: RELATION_DEPENDS_ON,
            }),
          );
          emittedEnvironments.add(path.sourceEnvironment);
        }

        // Target environments
        for (const target of path.targetEnvironments || []) {
          if (target.name && !emittedEnvironments.has(target.name)) {
            emit(
              processingResult.relation({
                source: sourceRef,
                target: {
                  kind: 'environment',
                  namespace: 'default',
                  name: target.name,
                },
                type: RELATION_DEPENDS_ON,
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
