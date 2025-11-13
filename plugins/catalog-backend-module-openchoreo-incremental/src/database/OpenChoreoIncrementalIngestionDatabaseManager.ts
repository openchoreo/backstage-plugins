/*
 * Copyright 2022 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Database manager for incremental ingestion operations.
 * Manages ingestion records, marks, and entity tracking to support
 * resumable, burst-based processing of large entity datasets.
 */

import { Knex } from 'knex';
import type { DeferredEntity } from '@backstage/plugin-catalog-node';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { Duration } from 'luxon';
import { v4 } from 'uuid';
import { LoggerService } from '@backstage/backend-plugin-api';
import {
  IngestionRecord,
  IngestionRecordUpdate,
  IngestionUpsert,
  MarkRecord,
  MarkRecordInsert,
} from './tables';
import {
  DatabaseTransactionError,
  DeadlockError,
  ConstraintViolationError,
  TransientDatabaseError,
} from './errors';

const POST_PROVIDER_RESET_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const MARK_ENTITY_DELETE_BATCH_SIZE = 100;
const MARK_ENTITY_INSERT_BATCH_SIZE = 100;
const DUPLICATE_INGESTION_AGE_THRESHOLD_MS = 60000;

/**
 * Database-specific SQL variable limits:
 * - SQLite: 999 (default), can be up to 32,766 at compile time
 * - PostgreSQL: 32,767 (hard limit from protocol)
 * - MySQL: 65,535
 * Using conservative limits to ensure compatibility across all configurations
 */
const SQL_VARIABLE_LIMITS = {
  sqlite3: 900, // Conservative limit for SQLite (default is 999)
  pg: 30000, // Conservative limit for PostgreSQL (max is 32,767)
  mysql: 60000, // Conservative limit for MySQL (max is 65,535)
  mysql2: 60000,
  default: 900, // Safe default for unknown databases
};

export class OpenChoreoIncrementalIngestionDatabaseManager {
  private client: Knex;
  private logger: LoggerService;
  private readonly batchSize: number;

  constructor(options: { client: Knex; logger: LoggerService }) {
    this.client = options.client;
    this.logger = options.logger;
    this.batchSize = this.determineBatchSize();
    this.logger.info(
      `Initialized database manager with batch size: ${this.batchSize} for client: ${this.client.client.config.client}`,
    );
  }

  /**
   * Determines the appropriate batch size for SQL IN clause operations
   * based on the database client type.
   */
  private determineBatchSize(): number {
    const clientType = this.client.client.config.client;
    const batchSize =
      SQL_VARIABLE_LIMITS[
        clientType as keyof typeof SQL_VARIABLE_LIMITS
      ] || SQL_VARIABLE_LIMITS.default;
    return batchSize;
  }

  /**
   * Safely formats an error for database storage.
   * Truncates the error message if it's too long to prevent database constraint violations.
   * @param error - The error to format
   * @param maxLength - Maximum length (default: 2000 for TEXT fields, set to safe limit)
   * @returns Formatted error string
   */
  private formatErrorForStorage(error: Error | string, maxLength = 2000): string {
    const errorString = String(error);
    if (errorString.length <= maxLength) {
      return errorString;
    }
    // Truncate with an indicator
    return errorString.substring(0, maxLength - 50) + '... [error truncated]';
  }

  /**
   * Helper method to execute a batched whereIn query operation.
   * Automatically chunks the values to stay within database limits.
   * 
   * This method prevents "too many SQL variables" errors that occur when
   * SQL IN clauses contain more parameters than the database can handle:
   * - SQLite: 999 variables (default)
   * - PostgreSQL: 32,767 variables (protocol limit)
   * - MySQL: 65,535 variables
   * 
   * @param tx - Knex transaction
   * @param tableName - Name of the table to query
   * @param column - Column name for the WHERE IN clause
   * @param values - Array of values to use in the IN clause
   * @param operation - Type of operation ('select', 'delete', or 'update')
   * @param updateData - Data to update (required for 'update' operation)
   * @returns Array of results for 'select' operations, empty array otherwise
   */
  private async batchedWhereIn<T>(
    tx: Knex.Transaction,
    tableName: string,
    column: string,
    values: any[],
    operation: 'select' | 'delete' | 'update',
    updateData?: any,
  ): Promise<T[]> {
    if (values.length === 0) {
      return [];
    }

    if (values.length > this.batchSize) {
      this.logger.debug(
        `Batching ${operation} operation for ${values.length} values into chunks of ${this.batchSize}`,
      );
    }

    const results: T[] = [];

    for (let i = 0; i < values.length; i += this.batchSize) {
      const chunk = values.slice(i, i + this.batchSize);
      const query = tx(tableName);

      if (operation === 'select') {
        const batchResults = await query.select('*').whereIn(column, chunk);
        results.push(...batchResults);
      } else if (operation === 'delete') {
        await query.delete().whereIn(column, chunk);
      } else if (operation === 'update' && updateData) {
        await query.update(updateData).whereIn(column, chunk);
      }
    }

    return results;
  }

  private async executeWithRetry<T>(
    operation: string,
    fn: (tx: Knex.Transaction) => Promise<T>,
    maxRetries = 3,
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.client.transaction(async tx => {
          return await fn(tx);
        });
      } catch (error) {
        lastError = error as Error;
        const errorCode = (error as any).code;

        if (errorCode === 'ER_LOCK_DEADLOCK' || errorCode === '40P01') {
          if (attempt < maxRetries) {
            const delay = Math.min(100 * Math.pow(2, attempt), 2000);
            this.logger.warn(
              `Deadlock detected in ${operation}, retrying in ${delay}ms (attempt ${
                attempt + 1
              }/${maxRetries})`,
            );
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          throw new DeadlockError(operation, error as Error);
        }

        if (errorCode === '23503' || errorCode === 'ER_NO_REFERENCED_ROW_2') {
          throw new ConstraintViolationError(
            'Foreign key constraint violation',
            operation,
            (error as any).constraint,
            error as Error,
          );
        }

        if (errorCode === '23505' || errorCode === 'ER_DUP_ENTRY') {
          throw new ConstraintViolationError(
            'Unique constraint violation',
            operation,
            (error as any).constraint,
            error as Error,
          );
        }

        if (errorCode === 'ECONNRESET' || errorCode === 'ETIMEDOUT') {
          if (attempt < maxRetries) {
            const delay = Math.min(500 * Math.pow(2, attempt), 5000);
            this.logger.warn(
              `Connection error in ${operation}, retrying in ${delay}ms`,
            );
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          throw new TransientDatabaseError(operation, error as Error);
        }

        this.logger.error(
          `Transaction failed in ${operation}: ${(error as Error).message}`,
          error as Error,
        );
        throw new DatabaseTransactionError(
          `Transaction failed: ${(error as Error).message}`,
          operation,
          error as Error,
        );
      }
    }

    throw new DatabaseTransactionError(
      lastError?.message ?? 'Unknown transaction error',
      operation,
      lastError,
    );
  }

  /**
   * Performs an update to the ingestion record with matching `id`.
   * @param options - IngestionRecordUpdate
   */
  async updateIngestionRecordById(options: IngestionRecordUpdate) {
    const { ingestionId, update } = options;
    try {
      await this.executeWithRetry(
        `updateIngestionRecordById(ingestionId=${ingestionId})`,
        async tx => {
          await tx('ingestions').where('id', ingestionId).update(update);
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to update ingestion record ${ingestionId}`,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Performs an update to the ingestion record with matching provider name. Will only update active records.
   * @param provider - string
   * @param update - Partial<IngestionUpsertIFace>
   */
  async updateIngestionRecordByProvider(
    provider: string,
    update: Partial<IngestionUpsert>,
  ) {
    try {
      await this.executeWithRetry(
        `updateIngestionRecordByProvider(provider=${provider})`,
        async tx => {
          await tx('ingestions')
            .where('provider_name', provider)
            .andWhere('completion_ticket', 'open')
            .update(update);
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to update ingestion record for provider ${provider}`,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Performs an insert into the `ingestions` table with the supplied values.
   * @param record - IngestionUpsertIFace
   */
  async insertIngestionRecord(record: IngestionUpsert) {
    try {
      await this.executeWithRetry(
        `insertIngestionRecord(id=${record.id})`,
        async tx => {
          await tx('ingestions').insert(record);
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to insert ingestion record ${record.id}`,
        error as Error,
      );
      throw error;
    }
  }

  private async deleteMarkEntities(
    tx: Knex.Transaction,
    ids: { id: string }[],
  ) {
    const chunks: { id: string }[][] = [];
    for (let i = 0; i < ids.length; i += MARK_ENTITY_DELETE_BATCH_SIZE) {
      const chunk = ids.slice(i, i + MARK_ENTITY_DELETE_BATCH_SIZE);
      chunks.push(chunk);
    }

    let deleted = 0;

    for (const chunk of chunks) {
      const chunkDeleted = await tx('ingestion_mark_entities')
        .delete()
        .whereIn(
          'id',
          chunk.map(entry => entry.id),
        );
      deleted += chunkDeleted;
    }

    return deleted;
  }

  /**
   * Finds the current ingestion record for the named provider.
   * @param provider - string
   * @returns IngestionRecord | undefined
   */
  async getCurrentIngestionRecord(provider: string) {
    try {
      return await this.executeWithRetry(
        `getCurrentIngestionRecord(provider=${provider})`,
        async tx => {
          const record = await tx<IngestionRecord>('ingestions')
            .where('provider_name', provider)
            .andWhere('completion_ticket', 'open')
            .first();
          return record;
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to get current ingestion record for provider ${provider}`,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Finds the last ingestion record for the named provider.
   * @param provider - string
   * @returns IngestionRecord | undefined
   */
  async getPreviousIngestionRecord(provider: string) {
    try {
      return await this.executeWithRetry(
        `getPreviousIngestionRecord(provider=${provider})`,
        async tx => {
          return await tx<IngestionRecord>('ingestions')
            .where('provider_name', provider)
            .andWhereNot('completion_ticket', 'open')
            .orderBy('rest_completed_at', 'desc')
            .first();
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to get previous ingestion record for provider ${provider}`,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Removes all entries from `ingestion_marks_entities`, `ingestion_marks`, and `ingestions`
   * for prior ingestions that completed (i.e., have a `completion_ticket` value other than 'open'),
   * except for the most recent completed ingestion which is kept for mark-and-sweep comparison.
   * @param provider - string
   * @returns A count of deletions for each record type.
   * 
   * Note: This method uses subqueries for deletion which doesn't require manual batching
   * as the database handles the query execution internally.
   */
  async clearFinishedIngestions(provider: string) {
    try {
      return await this.executeWithRetry(
        `clearFinishedIngestions(provider=${provider})`,
        async tx => {
          const mostRecentCompleted = await tx<IngestionRecord>('ingestions')
            .where('provider_name', provider)
            .andWhereNot('completion_ticket', 'open')
            .orderBy('rest_completed_at', 'desc')
            .first();

          const subquery = tx('ingestions')
            .select('id')
            .where('provider_name', provider)
            .andWhereNot('completion_ticket', 'open');

          if (mostRecentCompleted) {
            subquery.andWhereNot('id', mostRecentCompleted.id);
          }

          const markEntitiesDeleted = await tx('ingestion_mark_entities')
            .delete()
            .whereIn(
              'ingestion_mark_id',
              tx('ingestion_marks')
                .select('id')
                .whereIn('ingestion_id', subquery.clone()),
            );

          const marksDeleted = await tx('ingestion_marks')
            .delete()
            .whereIn('ingestion_id', subquery.clone());

          const ingestionsDeleted = await tx('ingestions')
            .delete()
            .whereIn('id', subquery.clone());

          return {
            deletions: {
              markEntitiesDeleted,
              marksDeleted,
              ingestionsDeleted,
            },
          };
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to clear finished ingestions for provider ${provider}`,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Automatically cleans up duplicate ingestion records if they were accidentally created.
   * Any ingestion record where the `rest_completed_at` is null (meaning it is active) AND
   * the ingestionId is incorrect is a duplicate ingestion record.
   * @param ingestionId - string
   * @param provider - string
   * 
   * Note: This method does not require batching as it operates on a small number of
   * ingestion metadata records, not entity data.
   */
  async clearDuplicateIngestions(ingestionId: string, provider: string) {
    try {
      await this.executeWithRetry(
        `clearDuplicateIngestions(ingestionId=${ingestionId}, provider=${provider})`,
        async tx => {
          const invalid = await tx<IngestionRecord>('ingestions')
            .where('provider_name', provider)
            .andWhere('rest_completed_at', null)
            .andWhereNot('id', ingestionId)
            .andWhere(
              'created_at',
              '<',
              new Date(Date.now() - DUPLICATE_INGESTION_AGE_THRESHOLD_MS),
            );

          if (invalid.length > 0) {
            await tx('ingestions')
              .delete()
              .whereIn(
                'id',
                invalid.map(i => i.id),
              );
            await tx('ingestion_mark_entities')
              .delete()
              .whereIn(
                'ingestion_mark_id',
                tx('ingestion_marks')
                  .select('id')
                  .whereIn(
                    'ingestion_id',
                    invalid.map(i => i.id),
                  ),
              );
            await tx('ingestion_marks')
              .delete()
              .whereIn(
                'ingestion_id',
                invalid.map(i => i.id),
              );
          }
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to clear duplicate ingestions for ${provider}`,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * This method fully purges and resets all ingestion records for the named provider, and
   * leaves it in a paused state.
   * @param provider - string
   * @returns Counts of all deleted ingestion records
   * 
   * Note: This method does not require batching for whereIn operations as it operates
   * on a small number of ingestion and mark metadata records per provider.
   */
  async purgeAndResetProvider(provider: string) {
    try {
      return await this.executeWithRetry(
        `purgeAndResetProvider(provider=${provider})`,
        async tx => {
          const ingestionIDs: { id: string }[] = await tx('ingestions')
            .select('id')
            .where('provider_name', provider);

          const markIDs: { id: string }[] =
            ingestionIDs.length > 0
              ? await tx('ingestion_marks')
                  .select('id')
                  .whereIn(
                    'ingestion_id',
                    ingestionIDs.map(entry => entry.id),
                  )
              : [];

          const markEntityIDs: { id: string }[] =
            markIDs.length > 0
              ? await tx('ingestion_mark_entities')
                  .select('id')
                  .whereIn(
                    'ingestion_mark_id',
                    markIDs.map(entry => entry.id),
                  )
              : [];

          const markEntitiesDeleted = await this.deleteMarkEntities(
            tx,
            markEntityIDs,
          );

          const marksDeleted =
            markIDs.length > 0
              ? await tx('ingestion_marks')
                  .delete()
                  .whereIn(
                    'ingestion_id',
                    ingestionIDs.map(entry => entry.id),
                  )
              : 0;

          const ingestionsDeleted = await tx('ingestions')
            .delete()
            .where('provider_name', provider);

          const next_action_at = new Date();
          next_action_at.setTime(
            next_action_at.getTime() + POST_PROVIDER_RESET_COOLDOWN_MS,
          );

          await tx('ingestions').insert({
            id: v4(),
            next_action: 'rest',
            provider_name: provider,
            next_action_at,
            ingestion_completed_at: new Date(),
            status: 'resting',
            completion_ticket: 'open',
          });

          return {
            provider,
            ingestionsDeleted,
            marksDeleted,
            markEntitiesDeleted,
          };
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to purge and reset provider ${provider}`,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * This method is used to remove entity records from the ingestion_mark_entities
   * table by their entity reference.
   */
  async deleteEntityRecordsByRef(entities: { entityRef: string }[]) {
    const refs = entities.map(e => e.entityRef);
    try {
      await this.executeWithRetry(
        `deleteEntityRecordsByRef(count=${refs.length})`,
        async tx => {
          // Delete in batches to avoid "too many SQL variables" error
          await this.batchedWhereIn(
            tx,
            'ingestion_mark_entities',
            'ref',
            refs,
            'delete',
          );
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete ${refs.length} entity records`,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Creates a new ingestion record.
   * @param provider - string
   * @returns A new ingestion record
   */
  async createProviderIngestionRecord(provider: string) {
    const ingestionId = v4();
    const nextAction = 'ingest';
    try {
      await this.insertIngestionRecord({
        id: ingestionId,
        next_action: nextAction,
        provider_name: provider,
        status: 'bursting',
        completion_ticket: 'open',
      });
      return { ingestionId, nextAction, attempts: 0, nextActionAt: Date.now() };
    } catch (error) {
      this.logger.error(
        `Failed to create ingestion record for provider ${provider} with ingestionId ${ingestionId}`,
        error as Error,
      );
      // Creating the ingestion record failed. Return undefined.
      return undefined;
    }
  }

  /**
   * Computes which entities to remove, if any, at the end of a burst.
   * Implements proper mark-and-sweep by comparing previous ingestion entities
   * against current ingestion entities to identify orphans.
   * @param provider - string
   * @param ingestionId - string
   * @returns All entities to remove for this burst.
   */
  async computeRemoved(provider: string, ingestionId: string) {
    const previousIngestion = await this.getPreviousIngestionRecord(provider);
    try {
      return await this.executeWithRetry(
        `computeRemoved(provider=${provider}, ingestionId=${ingestionId})`,
        async tx => {
          const count = await tx('ingestion_mark_entities')
            .count({ total: 'ingestion_mark_entities.ref' })
            .join(
              'ingestion_marks',
              'ingestion_marks.id',
              'ingestion_mark_entities.ingestion_mark_id',
            )
            .join('ingestions', 'ingestions.id', 'ingestion_marks.ingestion_id')
            .where('ingestions.id', ingestionId);

          const total = count.reduce(
            (acc, cur) => acc + (cur.total as number),
            0,
          );

          const removed: { entityRef: string }[] = [];

          const currentEntities: { ref: string }[] = await tx(
            'ingestion_mark_entities',
          )
            .select('ingestion_mark_entities.ref')
            .join(
              'ingestion_marks',
              'ingestion_marks.id',
              'ingestion_mark_entities.ingestion_mark_id',
            )
            .join('ingestions', 'ingestions.id', 'ingestion_marks.ingestion_id')
            .where('ingestions.id', ingestionId);

          const currentEntityRefs = new Set(currentEntities.map(e => e.ref));

          if (previousIngestion) {
            const previousEntities: { ref: string }[] = await tx(
              'ingestion_mark_entities',
            )
              .select('ingestion_mark_entities.ref')
              .join(
                'ingestion_marks',
                'ingestion_marks.id',
                'ingestion_mark_entities.ingestion_mark_id',
              )
              .join(
                'ingestions',
                'ingestions.id',
                'ingestion_marks.ingestion_id',
              )
              .where('ingestions.id', previousIngestion.id);

            const staleEntities = previousEntities.filter(
              entity => !currentEntityRefs.has(entity.ref),
            );

            for (const entityRef of staleEntities) {
              removed.push({ entityRef: entityRef.ref });
            }
          }

          const catalogEntities: {
            entity_ref: string;
            unprocessed_entity: string;
          }[] = await tx('refresh_state')
            .select(
              'refresh_state.entity_ref',
              'refresh_state.unprocessed_entity',
            )
            .leftJoin(
              'refresh_keys',
              'refresh_keys.entity_id',
              'refresh_state.entity_id',
            )
            .where('refresh_state.location_key', null)
            .whereNull('refresh_keys.entity_id');

          const filteredCatalogEntities = catalogEntities.filter(row => {
            try {
              const entity = JSON.parse(row.unprocessed_entity);
              const managedBy =
                entity?.metadata?.annotations?.[
                  'backstage.io/managed-by-location'
                ];
              return managedBy === `provider:${provider}`;
            } catch (error) {
              this.logger.debug(
                `Skipping entity ${row.entity_ref} with invalid JSON during removal computation: ${
                  (error as Error).message
                }`,
              );
              return false;
            }
          });

          for (const entity of filteredCatalogEntities) {
            if (!currentEntityRefs.has(entity.entity_ref)) {
              if (!removed.find(e => e.entityRef === entity.entity_ref)) {
                this.logger.info(
                  `computeRemoved: Found orphaned catalog entity ${entity.entity_ref} not in current or previous ingestion, marking for removal`,
                );
                removed.push({ entityRef: entity.entity_ref });
              }
            }
          }

          return { total, removed };
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to compute removed entities for ${provider}`,
        error as Error,
      );
      throw error;
    }
  }

  async getEntityCountsByKind(ingestionId: string) {
    try {
      return await this.executeWithRetry(
        `getEntityCountsByKind(ingestionId=${ingestionId})`,
        async tx => {
          const entityRefs: { ref: string }[] = await tx(
            'ingestion_mark_entities',
          )
            .select('ingestion_mark_entities.ref')
            .join(
              'ingestion_marks',
              'ingestion_marks.id',
              'ingestion_mark_entities.ingestion_mark_id',
            )
            .join('ingestions', 'ingestions.id', 'ingestion_marks.ingestion_id')
            .where('ingestions.id', ingestionId);

          // Count entities by kind - parse kind from entity ref format: <kind>:<namespace>/<name>
          const counts: Record<string, number> = {
            total: entityRefs.length,
          };
          
          let invalid = 0;

          for (const { ref } of entityRefs) {
            try {
              // Entity refs are in format: kind:namespace/name
              const colonIndex = ref.indexOf(':');
              if (colonIndex === -1) {
                invalid++;
                this.logger.warn(
                  `Invalid entity ref format (missing colon): ${ref} in ingestion ${ingestionId}`,
                );
                continue;
              }
              
              const kind = ref.substring(0, colonIndex).toLowerCase();
              
              if (!kind) {
                invalid++;
                this.logger.warn(
                  `Invalid entity ref format (empty kind): ${ref} in ingestion ${ingestionId}`,
                );
                continue;
              }
              
              counts[kind] = (counts[kind] || 0) + 1;
            } catch (error) {
              invalid++;
              this.logger.warn(
                `Failed to parse entity ref ${ref} in ingestion ${ingestionId}: ${
                  (error as Error).message
                }`,
              );
            }
          }

          if (invalid > 0) {
            counts.invalid = invalid;
            this.logger.warn(
              `Found ${invalid} entities with invalid ref format out of ${entityRefs.length} total entities in ingestion ${ingestionId}`,
            );
          }

          return counts;
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to get entity counts for ingestion ${ingestionId}`,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Performs a lookup of all providers that have duplicate active ingestion records.
   * @returns An array of all duplicate active ingestions
   */
  async healthcheck() {
    try {
      return await this.executeWithRetry('healthcheck', async tx => {
        const records = await tx<{ id: string; provider_name: string }>(
          'ingestions',
        )
          .distinct('id', 'provider_name')
          .where('rest_completed_at', null);
        return records;
      });
    } catch (error) {
      this.logger.error('Failed to perform healthcheck', error as Error);
      throw error;
    }
  }

  /**
   * Skips any wait time for the next action to run.
   * @param provider - string
   */
  async triggerNextProviderAction(provider: string) {
    await this.updateIngestionRecordByProvider(provider, {
      next_action_at: new Date(),
    });
  }

  /**
   * Purges the following tables:
   * * `ingestions`
   * * `ingestion_marks`
   * * `ingestion_mark_entities`
   *
   * This function leaves the ingestions table with all providers in a paused state.
   * @returns Results from cleaning up all ingestion tables.
   */
  async cleanupProviders() {
    const providers = await this.listProviders();

    const ingestionsDeleted = await this.purgeTable('ingestions');

    const next_action_at = new Date();
    next_action_at.setTime(
      next_action_at.getTime() + POST_PROVIDER_RESET_COOLDOWN_MS,
    );

    for (const provider of providers) {
      await this.insertIngestionRecord({
        id: v4(),
        next_action: 'rest',
        provider_name: provider,
        next_action_at,
        ingestion_completed_at: new Date(),
        status: 'resting',
        completion_ticket: 'open',
      });
    }

    const ingestionMarksDeleted = await this.purgeTable('ingestion_marks');
    const markEntitiesDeleted = await this.purgeTable(
      'ingestion_mark_entities',
    );

    return { ingestionsDeleted, ingestionMarksDeleted, markEntitiesDeleted };
  }

  /**
   * Configures the current ingestion record to ingest a burst.
   * @param ingestionId - string
   */
  async setProviderIngesting(ingestionId: string) {
    await this.updateIngestionRecordById({
      ingestionId,
      update: { next_action: 'ingest' },
    });
  }

  /**
   * Indicates the provider is currently ingesting a burst.
   * @param ingestionId - string
   */
  async setProviderBursting(ingestionId: string) {
    await this.updateIngestionRecordById({
      ingestionId,
      update: { status: 'bursting' },
    });
  }

  /**
   * Finalizes the current ingestion record to indicate that the post-ingestion rest period is complete.
   * @param ingestionId - string
   */
  async setProviderComplete(ingestionId: string) {
    await this.updateIngestionRecordById({
      ingestionId,
      update: {
        next_action: 'nothing (done)',
        rest_completed_at: new Date(),
        status: 'complete',
        completion_ticket: v4(),
      },
    });
  }

  /**
   * Marks ingestion as complete and starts the post-ingestion rest cycle.
   * @param ingestionId - string
   * @param restLength - Duration
   */
  async setProviderResting(ingestionId: string, restLength: Duration) {
    await this.updateIngestionRecordById({
      ingestionId,
      update: {
        next_action: 'rest',
        next_action_at: new Date(Date.now() + restLength.as('milliseconds')),
        ingestion_completed_at: new Date(),
        status: 'resting',
      },
    });
  }

  /**
   * Marks ingestion as paused after a burst completes.
   * @param ingestionId - string
   */
  async setProviderInterstitial(ingestionId: string) {
    await this.updateIngestionRecordById({
      ingestionId,
      update: { attempts: 0, status: 'interstitial' },
    });
  }

  /**
   * Starts the cancel process for the current ingestion.
   * @param ingestionId - string
   * @param message - string (optional)
   */
  async setProviderCanceling(ingestionId: string, message?: string) {
    const update: Partial<IngestionUpsert> = {
      next_action: 'cancel',
      last_error: message ? this.formatErrorForStorage(message) : undefined,
      next_action_at: new Date(),
      status: 'canceling',
    };
    await this.updateIngestionRecordById({ ingestionId, update });
  }

  /**
   * Completes the cancel process and triggers a new ingestion.
   * @param ingestionId - string
   */
  async setProviderCanceled(ingestionId: string) {
    await this.updateIngestionRecordById({
      ingestionId,
      update: {
        next_action: 'nothing (canceled)',
        rest_completed_at: new Date(),
        status: 'complete',
        completion_ticket: v4(),
      },
    });
  }

  /**
   * Configures the current ingestion to wait and retry, due to a data source error.
   * @param ingestionId - string
   * @param attempts - number
   * @param error - Error
   * @param backoffLength - number
   */
  async setProviderBackoff(
    ingestionId: string,
    attempts: number,
    error: Error,
    backoffLength: number,
  ) {
    await this.updateIngestionRecordById({
      ingestionId,
      update: {
        next_action: 'backoff',
        attempts: attempts + 1,
        last_error: this.formatErrorForStorage(error),
        next_action_at: new Date(Date.now() + backoffLength),
        status: 'backing off',
      },
    });
  }

  /**
   * Returns the last record from `ingestion_marks` for the supplied ingestionId.
   * @param ingestionId - string
   * @returns MarkRecord | undefined
   */
  async getLastMark(ingestionId: string) {
    try {
      return await this.executeWithRetry(
        `getLastMark(ingestionId=${ingestionId})`,
        async tx => {
          const mark = await tx<MarkRecord>('ingestion_marks')
            .where('ingestion_id', ingestionId)
            .orderBy('sequence', 'desc')
            .first();
          return this.#decodeMark(this.client, mark);
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to get last mark for ingestion ${ingestionId}`,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Returns the first record from `ingestion_marks` for the supplied ingestionId.
   * @param ingestionId - string
   * @returns MarkRecord | undefined
   */
  async getFirstMark(ingestionId: string) {
    try {
      return await this.executeWithRetry(
        `getFirstMark(ingestionId=${ingestionId})`,
        async tx => {
          const mark = await tx<MarkRecord>('ingestion_marks')
            .where('ingestion_id', ingestionId)
            .orderBy('sequence', 'asc')
            .first();
          return this.#decodeMark(this.client, mark);
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to get first mark for ingestion ${ingestionId}`,
        error as Error,
      );
      throw error;
    }
  }

  async getAllMarks(ingestionId: string) {
    try {
      return await this.executeWithRetry(
        `getAllMarks(ingestionId=${ingestionId})`,
        async tx => {
          const marks = await tx<MarkRecord>('ingestion_marks')
            .where('ingestion_id', ingestionId)
            .orderBy('sequence', 'desc');
          return marks.map(m => this.#decodeMark(this.client, m));
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to get all marks for ingestion ${ingestionId}`,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Performs an insert into the `ingestion_marks` table with the supplied values.
   * @param options - MarkRecordInsert
   */
  async createMark(options: MarkRecordInsert) {
    const { record } = options;
    try {
      await this.executeWithRetry(
        `createMark(ingestionId=${record.ingestion_id})`,
        async tx => {
          await tx('ingestion_marks').insert(record);
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to create mark for ingestion ${record.ingestion_id}`,
        error as Error,
      );
      throw error;
    }
  }

  // Handles the fact that sqlite does not support json columns; they just
  // persist the stringified data instead
  #decodeMark<T extends MarkRecord | undefined>(knex: Knex, record: T): T {
    if (record && knex.client.config.client.includes('sqlite3')) {
      try {
        return {
          ...record,
          cursor: JSON.parse(record.cursor as string),
        };
      } catch (error) {
        this.logger.error(
          `Failed to parse cursor JSON for mark record ${record.id}: ${
            (error as Error).message
          }. This indicates database corruption.`,
          error as Error,
        );
        throw new DatabaseTransactionError(
          `Failed to decode mark cursor: ${(error as Error).message}`,
          'decodeMark',
          error as Error,
        );
      }
    }
    return record;
  }

  /**
   * Performs an upsert to the `ingestion_mark_entities` table for all deferred entities.
   * @param markId - string
   * @param entities - DeferredEntity[]
   */
  async createMarkEntities(markId: string, entities: DeferredEntity[]) {
    const refs = entities.map(e => stringifyEntityRef(e.entity));

    try {
      await this.executeWithRetry(
        `createMarkEntities(markId=${markId}, count=${refs.length})`,
        async tx => {
          // Query existing refs in batches to avoid "too many SQL variables" error
          const existingRefsSet = new Set<string>();
          for (let i = 0; i < refs.length; i += this.batchSize) {
            const chunk = refs.slice(i, i + this.batchSize);
            const existingBatch = (
              await tx<{ ref: string }>('ingestion_mark_entities')
                .select('ref')
                .whereIn('ref', chunk)
            ).map(e => e.ref);
            existingBatch.forEach(ref => existingRefsSet.add(ref));
          }

          const existingRefsArray = Array.from(existingRefsSet);
          const newRefs = refs.filter(e => !existingRefsSet.has(e));

          // Update existing refs in batches
          if (existingRefsArray.length > 0) {
            await this.batchedWhereIn(
              tx,
              'ingestion_mark_entities',
              'ref',
              existingRefsArray,
              'update',
              { ingestion_mark_id: markId },
            );
          }

          if (newRefs.length > 0) {
            // Process newRefs in batches to avoid overwhelming the database
            for (
              let i = 0;
              i < newRefs.length;
              i += MARK_ENTITY_INSERT_BATCH_SIZE
            ) {
              const chunk = newRefs.slice(i, i + MARK_ENTITY_INSERT_BATCH_SIZE);
              await tx('ingestion_mark_entities').insert(
                chunk.map(ref => ({
                  id: v4(),
                  ingestion_mark_id: markId,
                  ref,
                })),
              );
              this.logger.info(
                `Batch ${
                  Math.floor(i / MARK_ENTITY_INSERT_BATCH_SIZE) + 1
                }/${Math.ceil(
                  newRefs.length / MARK_ENTITY_INSERT_BATCH_SIZE,
                )} completed: inserted ${
                  chunk.length
                } entities for mark ${markId}`,
              );
            }
          }
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to create mark entities for mark ${markId} (${refs.length} entities)`,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Deletes the entire content of a table, and returns the number of records deleted.
   * @param table - string
   * @returns number
   */
  async purgeTable(table: string) {
    try {
      return await this.executeWithRetry(`purgeTable(${table})`, async tx => {
        return await tx(table).delete();
      });
    } catch (error) {
      this.logger.error(`Failed to purge table ${table}`, error as Error);
      throw error;
    }
  }

  /**
   * Returns a list of all providers.
   * @returns string[]
   */
  async listProviders() {
    try {
      return await this.executeWithRetry('listProviders', async tx => {
        const providers = await tx<{ provider_name: string }>(
          'ingestions',
        ).distinct('provider_name');
        return providers.map(entry => entry.provider_name);
      });
    } catch (error) {
      this.logger.error('Failed to list providers', error as Error);
      throw error;
    }
  }

  async updateByName(provider: string, update: Partial<IngestionUpsert>) {
    await this.updateIngestionRecordByProvider(provider, update);
  }
}
