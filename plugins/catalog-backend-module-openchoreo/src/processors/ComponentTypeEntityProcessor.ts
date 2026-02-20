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
import {
  RELATION_USES_WORKFLOW,
  RELATION_WORKFLOW_USED_BY,
} from '@openchoreo/backstage-plugin-common';
import { ComponentTypeEntityV1alpha1 } from '../kinds/ComponentTypeEntityV1alpha1';

/**
 * Processor for ComponentType entities
 */
export class ComponentTypeEntityProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'ComponentTypeEntityProcessor';
  }

  async validateEntityKind(
    entity: ComponentTypeEntityV1alpha1,
  ): Promise<boolean> {
    return entity.kind === 'ComponentType';
  }

  async postProcessEntity(
    entity: ComponentTypeEntityV1alpha1,
    _location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<ComponentTypeEntityV1alpha1> {
    if (entity.kind === 'ComponentType') {
      if (!entity.spec?.type) {
        throw new Error('ComponentType entity must have spec.type');
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

      // Emit usesWorkflow/workflowUsedBy relationships for each allowed workflow
      if (entity.spec.allowedWorkflows) {
        for (const workflowName of entity.spec.allowedWorkflows) {
          const cwRef = {
            kind: 'componentworkflow',
            namespace: entity.metadata.namespace || 'default',
            name: workflowName,
          };
          emit(
            processingResult.relation({
              source: sourceRef,
              target: cwRef,
              type: RELATION_USES_WORKFLOW,
            }),
          );
          emit(
            processingResult.relation({
              source: cwRef,
              target: sourceRef,
              type: RELATION_WORKFLOW_USED_BY,
            }),
          );
        }
      }
    }

    return entity;
  }

  async preProcessEntity(
    entity: ComponentTypeEntityV1alpha1,
    _location: LocationSpec,
    _emit: CatalogProcessorEmit,
  ): Promise<ComponentTypeEntityV1alpha1> {
    if (entity.kind === 'ComponentType' && entity.spec) {
      if (!entity.spec.type) {
        entity.spec.type = 'component-type';
      }
    }

    return entity;
  }

  async processEntity(
    entity: ComponentTypeEntityV1alpha1,
    location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<ComponentTypeEntityV1alpha1> {
    if (entity.kind !== 'ComponentType') {
      return entity;
    }

    emit(processingResult.entity(location, entity));

    return entity;
  }
}
