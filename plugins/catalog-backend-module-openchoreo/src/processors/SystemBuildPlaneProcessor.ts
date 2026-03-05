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
 * to BuildPlane or ClusterBuildPlane based on annotations.
 */
export class SystemBuildPlaneProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'SystemBuildPlaneProcessor';
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
    const buildPlaneRef =
      annotations[CHOREO_ANNOTATIONS.BUILD_PLANE_REF]?.trim();
    const buildPlaneRefKind =
      annotations[CHOREO_ANNOTATIONS.BUILD_PLANE_REF_KIND]?.trim();

    if (buildPlaneRef) {
      const normalizedKind = (buildPlaneRefKind || 'BuildPlane').toLowerCase();
      if (
        normalizedKind !== 'buildplane' &&
        normalizedKind !== 'clusterbuildplane'
      ) {
        // Unrecognized build plane kind — skip relation
        return entity;
      }
      const isCluster = normalizedKind === 'clusterbuildplane';
      const targetKind = isCluster ? 'clusterbuildplane' : 'buildplane';
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
        name: buildPlaneRef,
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
