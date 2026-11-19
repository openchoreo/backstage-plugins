import type {
  LoggerService,
  RootConfigService,
} from '@backstage/backend-plugin-api';
import {
  parseEntityRef,
  stringifyEntityRef,
  type Entity,
} from '@backstage/catalog-model';
import type {
  CatalogService,
  CatalogServiceRequestOptions,
} from '@backstage/plugin-catalog-node';
import { valueAt } from './dryRun';

/** A kind whose entities also run the checks that match their parent. */
export interface InheritedChecks {
  kind: string;
  /** Dot path to the field holding the parent's entity ref. */
  parentField: string;
}

export function readInheritedChecks(
  config: RootConfigService,
): InheritedChecks[] {
  return (
    config
      .getOptionalConfigArray('techInsights.dynamicChecks.inheritChecks')
      ?.map(entry => ({
        kind: entry.getString('kind'),
        parentField: entry.getString('parentField'),
      })) ?? []
  );
}

/** Returns what check filters are matched against for an entity. */
export type FilterViewOf = (
  entity: Entity,
  options: CatalogServiceRequestOptions,
) => Promise<Entity>;

/**
 * For an entity of an inheriting kind, the view is its parent with the
 * entity's kind and name added as second values. jsonfc matches an array
 * when any element matches, so a filter written for the parent, or for the
 * entity's own kind or name, applies. Any other entity, or one whose parent
 * can't be read, is its own view.
 */
export function createFilterViewOf(options: {
  catalog: CatalogService;
  inheritedChecks: InheritedChecks[];
  logger: LoggerService;
}): FilterViewOf {
  const { catalog, inheritedChecks, logger } = options;
  return async (entity, requestOptions) => {
    const kind = entity.kind.toLocaleLowerCase('en-US');
    const inherited = inheritedChecks.find(
      candidate => candidate.kind.toLocaleLowerCase('en-US') === kind,
    );
    if (!inherited) return entity;
    const parentRef = valueAt(entity, inherited.parentField);
    if (typeof parentRef !== 'string' || !parentRef) return entity;

    let parent: Entity | undefined;
    try {
      parent = await catalog.getEntityByRef(
        parseEntityRef(parentRef, {
          defaultNamespace: entity.metadata.namespace,
        }),
        requestOptions,
      );
    } catch (e) {
      logger.warn(
        `Couldn't read ${parentRef}, so ${stringifyEntityRef(
          entity,
        )} runs only the checks that match it directly: ${e}`,
      );
      return entity;
    }
    if (!parent) return entity;

    return {
      ...parent,
      kind: [parent.kind, entity.kind],
      metadata: {
        ...parent.metadata,
        name: [parent.metadata.name, entity.metadata.name],
      },
    } as unknown as Entity;
  };
}

/**
 * jsonfc reads an entity from the catalog only to match check filters, and
 * reads facts by the ref it was asked about. Returning the filter view from
 * `getEntityByRef` therefore changes which checks run on an entity without
 * changing whose facts they read. Every other method is the catalog's own.
 */
export function withFilterViews(
  catalog: CatalogService,
  filterViewOf: FilterViewOf,
): CatalogService {
  const getEntityByRef: CatalogService['getEntityByRef'] = async (
    entityRef,
    options,
  ) => {
    const entity = await catalog.getEntityByRef(entityRef, options);
    return entity && filterViewOf(entity, options);
  };
  return new Proxy(catalog, {
    get(target, property) {
      if (property === 'getEntityByRef') return getEntityByRef;
      const value = Reflect.get(target, property);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
