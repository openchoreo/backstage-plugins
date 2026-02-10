import {
  CatalogProcessor,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { RELATION_PART_OF, parseEntityRef } from '@backstage/catalog-model';
import { ComponentWorkflowRunEntityV1alpha1 } from '../kinds/ComponentWorkflowRunEntityV1alpha1';

/**
 * Processor for ComponentWorkflowRun entities
 */
export class ComponentWorkflowRunEntityProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'ComponentWorkflowRunEntityProcessor';
  }

  async validateEntityKind(
    entity: ComponentWorkflowRunEntityV1alpha1,
  ): Promise<boolean> {
    return entity.kind === 'ComponentWorkflowRun';
  }

  async preProcessEntity(
    entity: ComponentWorkflowRunEntityV1alpha1,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<ComponentWorkflowRunEntityV1alpha1> {
    if (entity.kind === 'ComponentWorkflowRun' && entity.spec) {
      if (!entity.spec.type) {
        entity.spec.type = 'component-workflow-run';
      }
    }

    return entity;
  }

  async postProcessEntity(
    entity: ComponentWorkflowRunEntityV1alpha1,
    _location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<ComponentWorkflowRunEntityV1alpha1> {
    if (entity.kind === 'ComponentWorkflowRun') {
      if (!entity.spec?.type) {
        throw new Error('ComponentWorkflowRun entity must have spec.type');
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

  async processEntity(
    entity: ComponentWorkflowRunEntityV1alpha1,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<ComponentWorkflowRunEntityV1alpha1> {
    if (entity.kind !== 'ComponentWorkflowRun') {
      return entity;
    }

    emit(processingResult.entity(location, entity));

    return entity;
  }
}
