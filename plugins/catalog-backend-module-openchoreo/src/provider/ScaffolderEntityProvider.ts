import {
  EntityProvider,
  EntityProviderConnection,
} from '@backstage/plugin-catalog-node';
import { Entity } from '@backstage/catalog-model';
import { LoggerService } from '@backstage/backend-plugin-api';

/**
 * EntityProvider that supports immediate entity insertion via delta mutations.
 *
 * The catalog records the provider that applies a mutation as the owner of
 * the entities, regardless of the location key. Entities inserted here are
 * therefore owned by this provider, and OpenChoreoEntityProvider's delete
 * events and full sync cannot remove them. The location key only decides
 * which provider may claim an entity whose ref conflicts.
 *
 * @deprecated No longer registered by the catalog module.
 * `ImmediateCatalogService` now writes through `OpenChoreoEntityProvider`
 * (see `OpenChoreoEntityProvider.insertEntity`).
 */
export class ScaffolderEntityProvider implements EntityProvider {
  private connection?: EntityProviderConnection;
  private readonly logger: LoggerService;
  private readonly mainProviderName: string;

  constructor(
    logger: LoggerService,
    mainProviderName: string = 'OpenChoreoEntityProvider',
  ) {
    this.logger = logger;
    this.mainProviderName = mainProviderName;
  }

  getProviderName(): string {
    return 'ScaffolderEntityProvider';
  }

  async connect(connection: EntityProviderConnection): Promise<void> {
    this.connection = connection;
    this.logger.info('ScaffolderEntityProvider connected');
  }

  /**
   * Immediately inserts an entity into the catalog using delta mutation.
   * This bypasses the scheduled sync and makes the entity visible immediately.
   *
   * The entity is owned by this provider; see the class note.
   *
   * @param entity - The Backstage entity to insert
   */
  async insertEntity(entity: Entity): Promise<void> {
    if (!this.connection) {
      throw new Error('ScaffolderEntityProvider not connected to catalog');
    }

    this.logger.info(
      `Inserting entity immediately: ${entity.kind}:${
        entity.metadata.namespace || 'default'
      }/${entity.metadata.name}`,
    );

    try {
      // Lets OpenChoreoEntityProvider claim the entity on conflict; it does
      // not change which provider owns it.
      const locationKey = `provider:${this.mainProviderName}`;

      await this.connection.applyMutation({
        type: 'delta',
        added: [
          {
            entity,
            locationKey,
          },
        ],
        removed: [],
      });

      this.logger.info(
        `Successfully inserted entity: ${entity.metadata.name} (locationKey: ${locationKey})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to insert entity ${entity.metadata.name}: ${error}`,
      );
      throw error;
    }
  }

  /**
   * Immediately removes an entity inserted by this provider using delta
   * mutation.
   *
   * @param entityRef - The entity reference to remove
   */
  async removeEntity(entityRef: string): Promise<void> {
    if (!this.connection) {
      throw new Error('ScaffolderEntityProvider not connected to catalog');
    }

    this.logger.info(`Removing entity immediately: ${entityRef}`);

    try {
      const locationKey = `provider:${this.mainProviderName}`;

      await this.connection.applyMutation({
        type: 'delta',
        added: [],
        removed: [
          {
            entityRef,
            locationKey,
          },
        ],
      });

      this.logger.info(
        `Successfully removed entity: ${entityRef} (locationKey: ${locationKey})`,
      );
    } catch (error) {
      this.logger.error(`Failed to remove entity ${entityRef}: ${error}`);
      throw error;
    }
  }
}
