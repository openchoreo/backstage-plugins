import {
  CatalogProcessor,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import { RELATION_PART_OF, parseEntityRef } from '@backstage/catalog-model';
import { WorkflowRunEntityV1alpha1 } from '../kinds/WorkflowRunEntityV1alpha1';

/**
 * Processor for WorkflowRun entities
 */
export class WorkflowRunEntityProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'WorkflowRunEntityProcessor';
  }

  async validateEntityKind(
    entity: WorkflowRunEntityV1alpha1,
  ): Promise<boolean> {
    return entity.kind === 'WorkflowRun';
  }

  async preProcessEntity(
    entity: WorkflowRunEntityV1alpha1,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<WorkflowRunEntityV1alpha1> {
    if (entity.kind === 'WorkflowRun' && entity.spec) {
      if (!entity.spec.type) {
        entity.spec.type = 'workflow-run';
      }
    }

    return entity;
  }

  async postProcessEntity(
    entity: WorkflowRunEntityV1alpha1,
    _location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<WorkflowRunEntityV1alpha1> {
    if (entity.kind === 'WorkflowRun') {
      if (!entity.spec?.type) {
        throw new Error('WorkflowRun entity must have spec.type');
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
    entity: WorkflowRunEntityV1alpha1,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<WorkflowRunEntityV1alpha1> {
    if (entity.kind !== 'WorkflowRun') {
      return entity;
    }

    emit(processingResult.entity(location, entity));

    return entity;
  }
}
