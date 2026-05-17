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
 * Processor for Resource entities that emits instanceOf/hasInstance
 * relations to their (Cluster)ResourceType. Populates the Relations graph
 * on the type's catalog page with its consuming Resources, mirroring how
 * ComponentEntityProcessor wires Component → (Cluster)ComponentType.
 */
export class ResourceEntityProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'ResourceEntityProcessor';
  }

  async postProcessEntity(
    entity: Entity,
    _location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<Entity> {
    if (entity.kind !== 'Resource') {
      return entity;
    }

    const typeName =
      entity.metadata.annotations?.[CHOREO_ANNOTATIONS.RESOURCE_TYPE];
    if (!typeName) {
      return entity;
    }

    const sourceRef = {
      kind: entity.kind.toLowerCase(),
      namespace: entity.metadata.namespace || 'default',
      name: entity.metadata.name,
    };

    const resourceTypeKind =
      entity.metadata.annotations?.[CHOREO_ANNOTATIONS.RESOURCE_TYPE_KIND];
    const isClusterRT = resourceTypeKind === 'ClusterResourceType';

    const rtRef = {
      kind: isClusterRT ? 'clusterresourcetype' : 'resourcetype',
      namespace: isClusterRT
        ? 'openchoreo-cluster'
        : entity.metadata.namespace || 'default',
      name: typeName,
    };

    emit(
      processingResult.relation({
        source: sourceRef,
        target: rtRef,
        type: RELATION_INSTANCE_OF,
      }),
    );
    emit(
      processingResult.relation({
        source: rtRef,
        target: sourceRef,
        type: RELATION_HAS_INSTANCE,
      }),
    );

    return entity;
  }
}
