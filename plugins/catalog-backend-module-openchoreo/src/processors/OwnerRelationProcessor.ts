import {
  CatalogProcessor,
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import { LocationSpec } from '@backstage/plugin-catalog-common';
import {
  Entity,
  parseEntityRef,
  RELATION_OWNED_BY,
  RELATION_OWNER_OF,
} from '@backstage/catalog-model';

// Kinds Backstage's built-in processor already emits ownedBy for; skip them.
const BUILTIN_OWNED_KINDS = new Set([
  'component',
  'api',
  'system',
  'resource',
  'domain',
  'template',
  'group',
  'user',
  'location',
]);

/**
 * Emits ownedBy/ownerOf from `spec.owner` for custom OpenChoreo kinds that
 * Backstage's built-in owner processing skips.
 */
export class OwnerRelationProcessor implements CatalogProcessor {
  getProcessorName(): string {
    return 'OwnerRelationProcessor';
  }

  async postProcessEntity(
    entity: Entity,
    _location: LocationSpec,
    emit: CatalogProcessorEmit,
  ): Promise<Entity> {
    if (BUILTIN_OWNED_KINDS.has(entity.kind.toLowerCase())) {
      return entity;
    }

    const owner = (entity.spec as { owner?: unknown } | undefined)?.owner;
    if (typeof owner !== 'string' || !owner.trim()) {
      return entity;
    }

    let ownerRef;
    try {
      ownerRef = parseEntityRef(owner, {
        defaultKind: 'group',
        defaultNamespace: 'default',
      });
    } catch {
      return entity;
    }

    const self = {
      kind: entity.kind.toLowerCase(),
      namespace: (entity.metadata.namespace || 'default').toLowerCase(),
      name: entity.metadata.name,
    };

    emit(
      processingResult.relation({
        source: self,
        target: ownerRef,
        type: RELATION_OWNED_BY,
      }),
    );
    emit(
      processingResult.relation({
        source: ownerRef,
        target: self,
        type: RELATION_OWNER_OF,
      }),
    );

    return entity;
  }
}
