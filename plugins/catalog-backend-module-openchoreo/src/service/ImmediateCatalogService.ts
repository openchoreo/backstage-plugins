import { Entity } from '@backstage/catalog-model';
import { createServiceRef } from '@backstage/backend-plugin-api';

/**
 * Service interface for immediate catalog entity insertion.
 * This service is used by the scaffolder to immediately add newly created
 * components to the catalog without waiting for the scheduled sync.
 */
export interface ImmediateCatalogService {
  /**
   * Immediately inserts an entity into the catalog.
   * @param entity - The Backstage entity to insert
   */
  insertEntity(entity: Entity): Promise<void>;

  /**
   * Immediately removes an entity from the catalog.
   * @param entityRef - The entity reference to remove
   */
  removeEntity(entityRef: string): Promise<void>;
}

/**
 * Service reference for the ImmediateCatalogService.
 * This can be injected into other backend modules/plugins.
 */
export const immediateCatalogServiceRef =
  createServiceRef<ImmediateCatalogService>({
    id: 'openchoreo.immediate-catalog',
    scope: 'plugin',
    defaultFactory: async () => {
      throw new Error(
        'ImmediateCatalogService is not available. Make sure the catalog-backend-module-openchoreo is installed.',
      );
    },
  });
