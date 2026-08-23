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

import type { Knex } from 'knex';
import type { DeferredEntity } from '@backstage/plugin-catalog-node';
import type { Duration } from 'luxon';
import type { LoggerService } from '@backstage/backend-plugin-api';
import type {
  IngestionRecordUpdate,
  IngestionUpsert,
  MarkRecordInsert,
} from './tables';

export class OpenChoreoIncrementalIngestionDatabaseManager {
  constructor(readonly options: { client: Knex; logger: LoggerService }) {}

  async updateIngestionRecordById(_options: IngestionRecordUpdate) {
    throw new Error('M3: not implemented');
  }

  async updateIngestionRecordByProvider(
    _provider: string,
    _update: Partial<IngestionUpsert>,
  ) {
    throw new Error('M3: not implemented');
  }

  async insertIngestionRecord(_record: IngestionUpsert) {
    throw new Error('M3: not implemented');
  }

  async getCurrentIngestionRecord(_provider: string) {
    throw new Error('M3: not implemented');
  }

  async getPreviousIngestionRecord(_provider: string) {
    throw new Error('M3: not implemented');
  }

  async clearFinishedIngestions(_provider: string) {
    throw new Error('M3: not implemented');
  }

  async clearDuplicateIngestions(_ingestionId: string, _provider: string) {
    throw new Error('M3: not implemented');
  }

  async purgeAndResetProvider(_provider: string) {
    throw new Error('M3: not implemented');
  }

  async deleteEntityRecordsByRef(_entities: { entityRef: string }[]) {
    throw new Error('M3: not implemented');
  }

  async createProviderIngestionRecord(_provider: string) {
    throw new Error('M3: not implemented');
  }

  async computeRemoved(_provider: string, _ingestionId: string) {
    throw new Error('M3: not implemented');
  }

  async getEntityCountsByKind(_ingestionId: string) {
    throw new Error('M3: not implemented');
  }

  async healthcheck() {
    throw new Error('M3: not implemented');
  }

  async triggerNextProviderAction(_provider: string) {
    throw new Error('M3: not implemented');
  }

  async cleanupProviders() {
    throw new Error('M3: not implemented');
  }

  async setProviderIngesting(_ingestionId: string) {
    throw new Error('M3: not implemented');
  }

  async setProviderBursting(_ingestionId: string) {
    throw new Error('M3: not implemented');
  }

  async setProviderComplete(_ingestionId: string) {
    throw new Error('M3: not implemented');
  }

  async setProviderResting(_ingestionId: string, _restLength: Duration) {
    throw new Error('M3: not implemented');
  }

  async setProviderInterstitial(_ingestionId: string) {
    throw new Error('M3: not implemented');
  }

  async setProviderCanceling(_ingestionId: string, _message?: string) {
    throw new Error('M3: not implemented');
  }

  async setProviderCanceled(_ingestionId: string) {
    throw new Error('M3: not implemented');
  }

  async setProviderBackoff(
    _ingestionId: string,
    _attempts: number,
    _error: Error,
    _backoffLength: number,
  ) {
    throw new Error('M3: not implemented');
  }

  async getLastMark(_ingestionId: string) {
    throw new Error('M3: not implemented');
  }

  async getFirstMark(_ingestionId: string) {
    throw new Error('M3: not implemented');
  }

  async getAllMarks(_ingestionId: string) {
    throw new Error('M3: not implemented');
  }

  async createMark(_options: MarkRecordInsert) {
    throw new Error('M3: not implemented');
  }

  async createMarkEntities(_markId: string, _entities: DeferredEntity[]) {
    throw new Error('M3: not implemented');
  }

  async purgeTable(_table: string) {
    throw new Error('M3: not implemented');
  }

  async listProviders() {
    throw new Error('M3: not implemented');
  }

  async updateByName(_provider: string, _update: Partial<IngestionUpsert>) {
    throw new Error('M3: not implemented');
  }
}
