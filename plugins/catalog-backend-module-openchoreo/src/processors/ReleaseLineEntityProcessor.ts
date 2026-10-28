import {
  CatalogProcessor,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import {
  Entity,
  RELATION_HAS_PART,
  RELATION_OWNED_BY,
  RELATION_OWNER_OF,
  RELATION_PART_OF,
  parseEntityRef,
} from '@backstage/catalog-model';
import { ReleaseLineEntityV1alpha1 } from '../kinds/ReleaseLineEntityV1alpha1';

/**
 * Processor for ReleaseLine entities. Emits partOf/hasPart relations between
 * the line and its component, so the line's breadcrumb and quick switcher sit
 * under the component, and the component's relations list its lines.
 */
export class ReleaseLineEntityProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'ReleaseLineEntityProcessor';
  }

  async validateEntityKind(entity: Entity): Promise<boolean> {
    return entity.kind === 'ReleaseLine';
  }

  async postProcessEntity(
    entity: Entity,
    _location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<Entity> {
    if (entity.kind !== 'ReleaseLine') {
      return entity;
    }

    const releaseLine = entity as ReleaseLineEntityV1alpha1;
    if (!releaseLine.spec?.component) {
      throw new Error('ReleaseLine entity must have spec.component');
    }

    const namespace = entity.metadata.namespace || 'default';
    const sourceRef = {
      kind: 'releaseline',
      namespace,
      name: entity.metadata.name,
    };
    const componentRef = parseEntityRef(releaseLine.spec.component, {
      defaultKind: 'component',
      defaultNamespace: namespace,
    });

    emit(
      processingResult.relation({
        source: sourceRef,
        target: componentRef,
        type: RELATION_PART_OF,
      }),
    );
    emit(
      processingResult.relation({
        source: componentRef,
        target: sourceRef,
        type: RELATION_HAS_PART,
      }),
    );

    if (releaseLine.spec.owner) {
      const ownerRef = parseEntityRef(releaseLine.spec.owner, {
        defaultKind: 'group',
        defaultNamespace: namespace,
      });
      emit(
        processingResult.relation({
          source: sourceRef,
          target: ownerRef,
          type: RELATION_OWNED_BY,
        }),
      );
      emit(
        processingResult.relation({
          source: ownerRef,
          target: sourceRef,
          type: RELATION_OWNER_OF,
        }),
      );
    }

    return entity;
  }
}
