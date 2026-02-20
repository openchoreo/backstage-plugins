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
    }

    return entity;
  }

  async preProcessEntity(
    entity: ComponentWorkflowEntityV1alpha1,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<ComponentWorkflowEntityV1alpha1> {
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
