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

/*
 * This class implements the incremental ingestion engine for OpenChoreo.
 * It manages burst-based processing of entities using cursor-based pagination
 * to ensure efficient memory usage and resumable ingestion for large datasets.
 * Key features include state management, error handling with backoff, and event-driven updates.
 */

import type { DeferredEntity } from '@backstage/plugin-catalog-node';
import type { EventParams } from '@backstage/plugin-events-node';
import type { IterationEngine, IterationEngineOptions } from '../types';

export class OpenChoreoIncrementalIngestionEngine implements IterationEngine {
  constructor(readonly options: IterationEngineOptions) {}

  async taskFn(_signal: AbortSignal): Promise<void> {
    throw new Error('M3: not implemented');
  }

  async handleNextAction(_signal: AbortSignal): Promise<void> {
    throw new Error('M3: not implemented');
  }

  async getCurrentAction() {
    throw new Error('M3: not implemented');
  }

  async ingestOneBurst(_id: string, _signal: AbortSignal) {
    throw new Error('M3: not implemented');
  }

  async mark(_options: {
    id: string;
    sequence: number;
    entities?: DeferredEntity[];
    done: boolean;
    cursor?: unknown;
  }) {
    throw new Error('M3: not implemented');
  }

  async onEvent(_params: EventParams): Promise<void> {
    throw new Error('M3: not implemented');
  }

  supportsEventTopics(): string[] {
    return [];
  }
}
