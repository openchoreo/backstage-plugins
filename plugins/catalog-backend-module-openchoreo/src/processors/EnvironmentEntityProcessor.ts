import {
  CatalogProcessor,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { RELATION_PART_OF } from '@backstage/catalog-model';
import { EnvironmentEntityV1alpha1 } from '../kinds/EnvironmentEntityV1alpha1';
import {
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
        emit(
          processingResult.relation({
            source: sourceRef,
            target: {
              kind: 'domain',
              namespace: 'default',
              name: entity.spec.domain,
            },
            type: RELATION_PART_OF,
          }),
        );
      }

      // Emit hostedOn/hosts relationship between Environment and DataPlane
      if (entity.spec.dataPlaneRef) {
        const dataplaneRef = {
          kind: 'dataplane',
          namespace: 'default',
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
