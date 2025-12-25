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
 * Configuration schema for OpenChoreo incremental ingestion plugin.
 */

import { z } from 'zod';

/**
 * Configuration options for the OpenChoreo API connection.
 */
export declare const openchoreoApiConfigSchema: import('zod').ZodTypeAny;

/**
 * Configuration options for incremental ingestion behavior.
 */
export declare const openchoreoIncrementalConfigSchema: import('zod').ZodTypeAny;

/**
 * Complete configuration schema for OpenChoreo incremental plugin.
 */
export declare const openchoreoIncrementalConfigValidation: import('zod').ZodTypeAny;

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

/**
 * Legacy configuration interface for backward compatibility.
 * @deprecated Use OpenChoreoIncrementalConfig instead
 */
export interface Config {
  getOptionalString(key: string): string | undefined;
  getString(key: string): string;
  getOptionalNumber(key: string): number | undefined;
  getNumber(key: string): number;
  getOptionalBoolean(key: string): boolean | undefined;
  getBoolean(key: string): boolean;
  getOptionalConfig(key: string): Config | undefined;
  getConfig(key: string): Config;
  has(key: string): boolean;
  keys(): string[];
  optional?: Config[];
}
