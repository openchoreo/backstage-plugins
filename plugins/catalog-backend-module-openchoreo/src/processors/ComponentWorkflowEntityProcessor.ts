import {
  CatalogProcessor,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { RELATION_PART_OF, parseEntityRef } from '@backstage/catalog-model';
import { ComponentWorkflowEntityV1alpha1 } from '../kinds/ComponentWorkflowEntityV1alpha1';

/**
 * Processor for ComponentWorkflow entities
 */
export class ComponentWorkflowEntityProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'ComponentWorkflowEntityProcessor';
  }

  async validateEntityKind(
    entity: ComponentWorkflowEntityV1alpha1,
  ): Promise<boolean> {
    return entity.kind === 'ComponentWorkflow';
  }

  async postProcessEntity(
    entity: ComponentWorkflowEntityV1alpha1,
    _location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<ComponentWorkflowEntityV1alpha1> {
    if (entity.kind === 'ComponentWorkflow') {
      if (!entity.spec?.type) {
        throw new Error('ComponentWorkflow entity must have spec.type');
      }

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
        emit(
          processingResult.relation({
            source: sourceRef,
            target: {
              kind: domainRef.kind,
              namespace: domainRef.namespace,
              name: domainRef.name,
            },
            type: RELATION_PART_OF,
          }),
        );
      }
    }

    return entity;
  }

  async preProcessEntity(
    entity: ComponentWorkflowEntityV1alpha1,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<ComponentWorkflowEntityV1alpha1> {
    if (entity.kind === 'ComponentWorkflow' && entity.spec) {
      if (!entity.spec.type) {
        entity.spec.type = 'component-workflow';
      }
    }

    return entity;
  }

  async processEntity(
    entity: ComponentWorkflowEntityV1alpha1,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<ComponentWorkflowEntityV1alpha1> {
    if (entity.kind !== 'ComponentWorkflow') {
      return entity;
    }

    emit(processingResult.entity(location, entity));

    return entity;
  }
}
