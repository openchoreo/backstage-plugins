import {
  CatalogProcessor,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { Entity } from '@backstage/catalog-model';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import {
  CHOREO_ANNOTATIONS,
  RELATION_INSTANCE_OF,
  RELATION_HAS_INSTANCE,
} from '@openchoreo/backstage-plugin-common';

/**
 * Processor for Component entities that emits instanceOf/hasInstance
 * relations to their ComponentType.
 */
export class ComponentEntityProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'ComponentEntityProcessor';
  }

  async postProcessEntity(
    entity: Entity,
    _location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<Entity> {
    if (entity.kind !== 'Component') {
      return entity;
    }

    const componentType =
      entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT_TYPE];
    if (!componentType) {
      return entity;
    }

    // Parse "deployment/service" → "service", "cronjob/scheduled-task" → "scheduled-task"
    const match = componentType.match(
      /^(?:deployment|statefulset|cronjob|job)\/(.+)$/,
    );
    const typeName = match ? match[1] : componentType;

    const sourceRef = {
      kind: entity.kind.toLowerCase(),
      namespace: entity.metadata.namespace || 'default',
      name: entity.metadata.name,
    };

    const ctRef = {
      kind: 'componenttype',
      namespace: entity.metadata.namespace || 'default',
      name: typeName,
    };

    emit(
      processingResult.relation({
        source: sourceRef,
        target: ctRef,
        type: RELATION_INSTANCE_OF,
      }),
    );
    emit(
      processingResult.relation({
        source: ctRef,
        target: sourceRef,
        type: RELATION_HAS_INSTANCE,
      }),
    );

    return entity;
  }
}
