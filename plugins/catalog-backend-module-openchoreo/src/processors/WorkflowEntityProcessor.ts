import {
  CatalogProcessor,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { RELATION_PART_OF, parseEntityRef } from '@backstage/catalog-model';
import { WorkflowEntityV1alpha1 } from '../kinds/WorkflowEntityV1alpha1';

/**
 * Processor for Workflow entities
 */
export class WorkflowEntityProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'WorkflowEntityProcessor';
  }

  async validateEntityKind(entity: WorkflowEntityV1alpha1): Promise<boolean> {
    return entity.kind === 'Workflow';
  }

  async postProcessEntity(
    entity: WorkflowEntityV1alpha1,
    _location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<WorkflowEntityV1alpha1> {
    if (entity.kind === 'Workflow') {
      if (!entity.spec?.type) {
        throw new Error('Workflow entity must have spec.type');
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
    entity: WorkflowEntityV1alpha1,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<WorkflowEntityV1alpha1> {
    if (entity.kind === 'Workflow' && entity.spec) {
      if (!entity.spec.type) {
        entity.spec.type = 'workflow';
      }
    }

    return entity;
  }

  async processEntity(
    entity: WorkflowEntityV1alpha1,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<WorkflowEntityV1alpha1> {
    if (entity.kind !== 'Workflow') {
      return entity;
    }

    emit(processingResult.entity(location, entity));

    return entity;
  }
}
