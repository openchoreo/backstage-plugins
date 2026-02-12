import { Knex } from 'knex';
import { createServiceRef, LoggerService } from '@backstage/backend-plugin-api';

const TABLE_NAME = 'entity_custom_annotations';

/**
 * Service interface for managing custom annotations on catalog entities.
 * Annotations are stored in a dedicated database table and survive
 * entity provider full mutations by being re-applied via a CatalogProcessor.
 */
export interface AnnotationStore {
  /**
   * Get all custom annotations for an entity.
   * @param entityRef - The entity reference (e.g., "component:default/my-component")
   * @returns A record of annotation key-value pairs
   */
  getAnnotations(entityRef: string): Promise<Record<string, string>>;

  /**
   * Set custom annotations for an entity.
   * Upserts the given annotations. A null value deletes that annotation key.
   * @param entityRef - The entity reference
   * @param annotations - Key-value pairs to set. null value means delete.
   */
  setAnnotations(
    entityRef: string,
    annotations: Record<string, string | null>,
  ): Promise<void>;

  /**
   * Delete all custom annotations for an entity.
   * @param entityRef - The entity reference
   */
  deleteAllAnnotations(entityRef: string): Promise<void>;
}

interface AnnotationRow {
  entity_ref: string;
  annotation_key: string;
  annotation_value: string;
  updated_at: string;
}

function isDuplicateObjectError(error: unknown): boolean {
  const message = String(error).toLowerCase();
  const code =
    error instanceof Error
      ? (error as Error & { code?: string }).code
      : undefined;

  // SQLite: message contains "already exists"
  // PostgreSQL: error code 42P07 (duplicate_table) or 42710 (duplicate_object)
  // MySQL: error code ER_TABLE_EXISTS_ERROR / ER_DUP_KEYNAME
  return (
    message.includes('already exists') ||
    message.includes('duplicate') ||
    code === '42P07' ||
    code === '42710' ||
    code === 'ER_TABLE_EXISTS_ERROR' ||
    code === 'ER_DUP_KEYNAME'
  );
}

/**
 * Creates the entity_custom_annotations table if it doesn't exist.
 */
export async function applyAnnotationStoreMigrations(
  knex: Knex,
  logger: LoggerService,
): Promise<void> {
  const hasTable = await knex.schema.hasTable(TABLE_NAME);
  if (!hasTable) {
    try {
      await knex.schema.createTable(TABLE_NAME, table => {
        table.string('entity_ref', 255).notNullable();
        table.string('annotation_key', 255).notNullable();
        table.text('annotation_value').notNullable();
        table.timestamp('updated_at').defaultTo(knex.fn.now());
        table.primary(['entity_ref', 'annotation_key']);
      });
    } catch (error) {
      if (isDuplicateObjectError(error)) {
        logger.warn(
          `Table ${TABLE_NAME} already exists, skipping creation (concurrent startup race condition)`,
          { error: String(error) },
        );
      } else {
        throw error;
      }
    }
  }

  try {
    await knex.schema.alterTable(TABLE_NAME, table => {
      table.index(['entity_ref'], 'idx_entity_custom_annotations_ref');
    });
  } catch (error) {
    if (isDuplicateObjectError(error)) {
      logger.debug(
        `Index idx_entity_custom_annotations_ref already exists, skipping creation`,
        { error: String(error) },
      );
    } else {
      throw error;
    }
  }
}

/**
 * Default implementation of the AnnotationStore backed by a database table.
 */
export class DatabaseAnnotationStore implements AnnotationStore {
  constructor(private readonly knex: Knex) {}

  async getAnnotations(entityRef: string): Promise<Record<string, string>> {
    const rows = await this.knex<AnnotationRow>(TABLE_NAME)
      .where('entity_ref', entityRef)
      .select('annotation_key', 'annotation_value');

    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.annotation_key] = row.annotation_value;
    }
    return result;
  }

  async setAnnotations(
    entityRef: string,
    annotations: Record<string, string | null>,
  ): Promise<void> {
    await this.knex.transaction(async tx => {
      for (const [key, value] of Object.entries(annotations)) {
        if (value === null) {
          // Delete the annotation
          await tx<AnnotationRow>(TABLE_NAME)
            .where({ entity_ref: entityRef, annotation_key: key })
            .delete();
        } else {
          // Upsert the annotation
          const existing = await tx<AnnotationRow>(TABLE_NAME)
            .where({ entity_ref: entityRef, annotation_key: key })
            .first();

          if (existing) {
            await tx<AnnotationRow>(TABLE_NAME)
              .where({ entity_ref: entityRef, annotation_key: key })
              .update({
                annotation_value: value,
                updated_at: tx.fn.now(),
              });
          } else {
            await tx<AnnotationRow>(TABLE_NAME).insert({
              entity_ref: entityRef,
              annotation_key: key,
              annotation_value: value,
              updated_at: tx.fn.now() as unknown as string,
            });
          }
        }
      }
    });
  }

  async deleteAllAnnotations(entityRef: string): Promise<void> {
    await this.knex<AnnotationRow>(TABLE_NAME)
      .where('entity_ref', entityRef)
      .delete();
  }
}

/**
 * Service reference for the AnnotationStore.
 * This can be injected into other backend modules/plugins.
 *
 * NOTE: scope is 'plugin' which means each plugin gets its own instance.
 * However, the annotationStoreFactory uses a module-level singleton pattern
 * to ensure all plugins share the same database connection. The singleton
 * is initialized by the catalog module during startup and reused by other
 * plugins (like openchoreo-backend).
 */
export const annotationStoreRef = createServiceRef<AnnotationStore>({
  id: 'openchoreo.annotation-store',
  scope: 'plugin',
  defaultFactory: async () => {
    throw new Error(
      'AnnotationStore is not available. Make sure the catalog-backend-module-openchoreo is installed.',
    );
  },
});
