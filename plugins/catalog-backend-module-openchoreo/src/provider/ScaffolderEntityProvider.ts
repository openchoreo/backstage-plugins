import {
  EntityProvider,
  EntityProviderConnection,
} from '@backstage/plugin-catalog-node';
import { Entity } from '@backstage/catalog-model';
import { LoggerService } from '@backstage/backend-plugin-api';

/**
 * EntityProvider that supports immediate entity insertion via delta mutations.
 * This provider is used by the scaffolder to immediately add newly created
 * components to the catalog without waiting for the scheduled sync.
 *
 * IMPORTANT: This provider uses the same location key as OpenChoreoEntityProvider
 * to ensure that entities are managed in the same bucket. This allows the scheduled
 * full sync to naturally remove deleted components.
 */
export class ScaffolderEntityProvider implements EntityProvider {
  private connection?: EntityProviderConnection;
  private readonly logger: LoggerService;
  private readonly mainProviderName: string;

  constructor(logger: LoggerService, mainProviderName: string = 'OpenChoreoEntityProvider') {
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
   * Uses the same location key as the main OpenChoreoEntityProvider to ensure
   * that the entity is managed in the same bucket. When the scheduled sync runs,
   * it will perform a full mutation that replaces all entities from the API,
   * which naturally removes any deleted components.
   *
   * @param entity - The Backstage entity to insert
   */
  async insertEntity(entity: Entity): Promise<void> {
    if (!this.connection) {
      throw new Error('ScaffolderEntityProvider not connected to catalog');
    }

    this.logger.info(
      `Inserting entity immediately: ${entity.kind}:${entity.metadata.namespace || 'default'}/${entity.metadata.name}`,
    );

    try {
      // Use the same location key as OpenChoreoEntityProvider
      // This ensures entities are in the same bucket and full sync will manage them
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
   * Immediately removes an entity from the catalog using delta mutation.
   *
   * Note: This is rarely needed since the scheduled full sync will automatically
   * remove entities that no longer exist in the OpenChoreo API.
   *
   * @param entityRef - The entity reference to remove
   */
  async removeEntity(entityRef: string): Promise<void> {
    if (!this.connection) {
      throw new Error('ScaffolderEntityProvider not connected to catalog');
    }

    this.logger.info(`Removing entity immediately: ${entityRef}`);

    try {
      // Use the same location key as OpenChoreoEntityProvider
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
