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
import { EnvironmentEntityV1alpha1 } from '../kinds/EnvironmentEntityV1alpha1';
import {
  CHOREO_ANNOTATIONS,
  RELATION_HOSTED_ON,
  RELATION_HOSTS,
} from '@openchoreo/backstage-plugin-common';

/**
 * Processor for Environment entities
 */
export class EnvironmentEntityProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'EnvironmentEntityProcessor';
  }

  async validateEntityKind(
    entity: EnvironmentEntityV1alpha1,
  ): Promise<boolean> {
    return entity.kind === 'Environment';
  }

  async postProcessEntity(
    entity: EnvironmentEntityV1alpha1,
    _location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<EnvironmentEntityV1alpha1> {
    // Validate required fields
    if (entity.kind === 'Environment') {
      if (!entity.spec?.type) {
        throw new Error('Environment entity must have spec.type');
      }

      // Emit relationships based on spec fields
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

      // Emit hostedOn/hosts relationship between Environment and DataPlane/ClusterDataPlane
      if (entity.spec.dataPlaneRef) {
        const refKind = (
          entity.metadata.annotations?.[
            CHOREO_ANNOTATIONS.DATA_PLANE_REF_KIND
          ] || ''
        )
          .trim()
          .toLowerCase();
        const isClusterDataPlane = refKind === 'clusterdataplane';

        const dataplaneRef = {
          kind: isClusterDataPlane ? 'clusterdataplane' : 'dataplane',
          namespace: isClusterDataPlane
            ? 'openchoreo-cluster'
            : entity.metadata.namespace || 'default',
          name: entity.spec.dataPlaneRef,
        };
        // Environment hostedOn DataPlane
        emit(
          processingResult.relation({
            source: sourceRef,
            target: dataplaneRef,
            type: RELATION_HOSTED_ON,
          }),
        );
        // DataPlane hosts Environment (inverse)
        emit(
          processingResult.relation({
            source: dataplaneRef,
            target: sourceRef,
            type: RELATION_HOSTS,
          }),
        );
      }
    }

    return entity;
  }

  async preProcessEntity(
    entity: EnvironmentEntityV1alpha1,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<EnvironmentEntityV1alpha1> {
    // Set default values if needed
    if (entity.kind === 'Environment' && entity.spec) {
      // Set default isProduction if not specified
      if (entity.spec.isProduction === undefined) {
        entity.spec.isProduction = entity.spec.type === 'production';
      }
    }

    return entity;
  }

  async processEntity(
    entity: EnvironmentEntityV1alpha1,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<EnvironmentEntityV1alpha1> {
    // Only process Environment entities
    if (entity.kind !== 'Environment') {
      return entity;
    }

    // Emit the processed entity
    emit(processingResult.entity(location, entity));

    return entity;
  }
}
