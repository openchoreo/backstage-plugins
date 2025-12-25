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

import { z } from 'zod';

/**
 * Configuration options for the OpenChoreo API connection.
 */
export const openchoreoApiConfigSchema = z.object({
  /**
   * Base URL for the OpenChoreo API.
   */
  baseUrl: z.string().url().describe('OpenChoreo API base URL'),

  /**
   * Optional authentication token for API access.
   */
  token: z.string().optional().describe('OpenChoreo API authentication token'),
});

/**
 * Configuration options for incremental ingestion behavior.
 */
export const openchoreoIncrementalConfigSchema = z.object({
  /**
   * Duration of each ingestion burst in seconds. Must be between 1 and 300.
   * @default 10
   */
  burstLength: z
    .number()
    .min(1)
    .max(300)
    .default(10)
    .describe('Duration of ingestion bursts in seconds'),

  /**
   * Interval between ingestion bursts in seconds. Must be between 5 and 300.
   * @default 30
   */
  burstInterval: z
    .number()
    .min(5)
    .max(300)
    .default(30)
    .describe('Interval between ingestion bursts in seconds'),

  /**
   * Rest period after successful ingestion in minutes. Must be between 1 and 1440.
   * @default 30
   */
  restLength: z
    .number()
    .min(1)
    .max(1440)
    .default(30)
    .describe('Rest period after ingestion in minutes'),

  /**
   * Number of entities to process in each batch. Must be between 1 and 1000.
   * @default 50
   */
  chunkSize: z
    .number()
    .min(1)
    .max(1000)
    .default(50)
    .describe('Number of entities per batch'),

  /**
   * Backoff strategy for failed ingestion attempts in seconds.
   */
  backoff: z
    .array(z.number().positive())
    .optional()
    .describe('Backoff durations in seconds'),

  /**
   * Percentage threshold above which entity removals will be rejected (0-100).
   */
  rejectRemovalsAbovePercentage: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe('Removal rejection threshold percentage'),

  /**
   * Whether to reject removals when source collections are empty.
   * @default false
   */
  rejectEmptySourceCollections: z
    .boolean()
    .default(false)
    .describe('Reject removals from empty collections'),

  /**
   * Maximum number of concurrent API requests during batch processing.
   * Must be between 1 and 50.
   * @default 5
   */
  maxConcurrentRequests: z
    .number()
    .min(1)
    .max(50)
    .default(5)
    .describe('Maximum concurrent API requests during batch processing'),

  /**
   * Delay in milliseconds between batch processing requests.
   * Must be between 0 and 10000.
   * @default 100
   */
  batchDelayMs: z
    .number()
    .min(0)
    .max(10000)
    .default(100)
    .describe('Delay in milliseconds between batch processing requests'),
});

/**
 * Complete configuration schema for OpenChoreo incremental plugin.
 */
export const openchoreoIncrementalConfigValidation = z.object({
  openchoreo: z.object({
    api: openchoreoApiConfigSchema.optional(),
    incremental: openchoreoIncrementalConfigSchema.optional(),
  }),
});

/**
 * TypeScript interface for the complete OpenChoreo configuration.
 */
export interface OpenChoreoIncrementalConfig {
  openchoreo: {
    api?: {
      baseUrl: string;
      token?: string;
    };
    incremental?: {
      burstLength: number;
      burstInterval: number;
      restLength: number;
      chunkSize: number;
      backoff?: number[];
      rejectRemovalsAbovePercentage?: number;
      rejectEmptySourceCollections: boolean;
      maxConcurrentRequests: number;
      batchDelayMs: number;
    };
  };
}
