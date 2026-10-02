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
import { HookEntityV1alpha1 } from '../kinds/HookEntityV1alpha1';
import { emitHookWorkflowRelation } from './hookRelations';

/**
 * Processor for Hook entities (deployment hooks, alpha).
 * Emits partOf → domain and usesWorkflow → the Workflow/ClusterWorkflow it runs.
 */
export class HookEntityProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'HookEntityProcessor';
  }

  async validateEntityKind(entity: HookEntityV1alpha1): Promise<boolean> {
    return entity.kind === 'Hook';
  }

  async postProcessEntity(
    entity: HookEntityV1alpha1,
    _location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<HookEntityV1alpha1> {
    if (entity.kind !== 'Hook') {
      return entity;
    }
    const sourceRef = {
      kind: entity.kind.toLowerCase(),
      namespace: entity.metadata.namespace || 'default',
      name: entity.metadata.name,
    };

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

    emitHookWorkflowRelation(sourceRef, entity.spec.workflowRef, emit);

    return entity;
  }

  async preProcessEntity(
    entity: HookEntityV1alpha1,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<HookEntityV1alpha1> {
    return entity;
  }

  async processEntity(
    entity: HookEntityV1alpha1,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<HookEntityV1alpha1> {
    if (entity.kind !== 'Hook') {
      return entity;
    }

    emit(processingResult.entity(location, entity));

    return entity;
  }
}
