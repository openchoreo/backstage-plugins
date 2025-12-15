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

import { Config } from '@backstage/config';
import { LoggerService } from '@backstage/backend-plugin-api';
import {
  openchoreoIncrementalConfigValidation,
  OpenChoreoIncrementalConfig,
} from '../config.d';
import { OpenChoreoIncrementalIngestionError } from '../database/errors';

/**
 * Utility class for validating OpenChoreo incremental plugin configuration.
 */
export class ConfigValidator {
  /**
   * Validates the complete OpenChoreo configuration.
   *
   * @param config - The Backstage configuration object
   * @param logger - Logger service for reporting validation issues
   * @returns Validated configuration object
   * @throws OpenChoreoIncrementalIngestionError for invalid configuration
   */
  static validateConfig(
    config: Config,
    logger: LoggerService,
  ): OpenChoreoIncrementalConfig {
    try {
      // Extract the raw configuration data
      const rawConfig = this.extractRawConfig(config);

      // Validate using Zod schema
      const validatedConfig = openchoreoIncrementalConfigValidation.parse(
        rawConfig,
      ) as OpenChoreoIncrementalConfig;

      // Apply additional business logic validation
      this.validateBusinessRules(validatedConfig, logger);

      return validatedConfig;
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        const zodError = error as any;
        const errorMessages =
          zodError.errors
            ?.map(
              (err: any) =>
                `${err.path?.join('.') || 'unknown'}: ${err.message}`,
            )
            .join(', ') || 'Unknown validation error';

        throw new OpenChoreoIncrementalIngestionError(
          `Configuration validation failed: ${errorMessages}`,
          'CONFIG_VALIDATION_ERROR',
          error,
        );
      }

      throw new OpenChoreoIncrementalIngestionError(
        `Failed to validate configuration: ${
          error instanceof Error ? error.message : String(error)
        }`,
        'CONFIG_VALIDATION_ERROR',
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Extracts raw configuration data from Backstage config object.
   *
   * @param config - The Backstage configuration object
   * @returns Raw configuration data
   */
  private static extractRawConfig(config: Config): any {
    // Initialize with empty openchoreo object to ensure it's always present
    const rawConfig: any = {
      openchoreo: {},
    };

    // Extract OpenChoreo API configuration
    if (config.has('openchoreo.api')) {
      rawConfig.openchoreo = {
        ...rawConfig.openchoreo,
        api: {
          baseUrl: config.getString('openchoreo.api.baseUrl'),
          ...(config.has('openchoreo.api.token') && {
            token: config.getString('openchoreo.api.token'),
          }),
        },
      };
    }

    // Extract OpenChoreo incremental configuration
    if (config.has('openchoreo.incremental')) {
      const incrementalConfig = config.getConfig('openchoreo.incremental');

      rawConfig.openchoreo = {
        ...rawConfig.openchoreo,
        incremental: {
          burstLength: incrementalConfig.getOptionalNumber('burstLength'),
          burstInterval: incrementalConfig.getOptionalNumber('burstInterval'),
          restLength: incrementalConfig.getOptionalNumber('restLength'),
          chunkSize: incrementalConfig.getOptionalNumber('chunkSize'),
          backoff: undefined, // TODO: Implement proper backoff array parsing
          rejectRemovalsAbovePercentage: incrementalConfig.getOptionalNumber(
            'rejectRemovalsAbovePercentage',
          ),
          rejectEmptySourceCollections: incrementalConfig.getOptionalBoolean(
            'rejectEmptySourceCollections',
          ),
          maxConcurrentRequests: incrementalConfig.getOptionalNumber(
            'maxConcurrentRequests',
          ),
          batchDelayMs: incrementalConfig.getOptionalNumber('batchDelayMs'),
        },
      };
    }

    return rawConfig;
  }

  /**
   * Validates additional business rules beyond schema validation.
   *
   * @param config - Validated configuration object
   * @param logger - Logger service for warnings
   */
  private static validateBusinessRules(
    config: OpenChoreoIncrementalConfig,
    logger: LoggerService,
  ): void {
    const incremental = config.openchoreo.incremental;

    if (!incremental) {
      return; // No incremental config to validate
    }

    // Validate timing relationships
    if (incremental.burstLength >= incremental.burstInterval) {
      throw new OpenChoreoIncrementalIngestionError(
        `burstLength (${incremental.burstLength}s) must be less than burstInterval (${incremental.burstInterval}s) to ensure proper burst/rest cycle. Current configuration would cause overlapping or continuous bursts.`,
        'INVALID_BURST_TIMING',
      );
    }

    // Validate chunk size vs burst length
    const maxEntitiesPerBurst = incremental.burstLength * 10; // Rough estimate
    if (incremental.chunkSize > maxEntitiesPerBurst) {
      logger.warn(
        `chunkSize (${incremental.chunkSize}) may be too large for burstLength (${incremental.burstLength}s). Consider reducing chunk size or increasing burst length.`,
      );
    }

    // Validate backoff configuration
    if (incremental.backoff && incremental.backoff.length > 0) {
      if (incremental.backoff.some(delay => delay <= 0)) {
        throw new OpenChoreoIncrementalIngestionError(
          'All backoff durations must be positive numbers',
          'INVALID_BACKOFF_CONFIG',
        );
      }

      if (incremental.backoff.length > 10) {
        logger.warn(
          `Backoff array has ${incremental.backoff.length} entries, which may be excessive. Consider using fewer, longer delays.`,
        );
      }
    }

    // Validate removal percentage
    if (incremental.rejectRemovalsAbovePercentage !== undefined) {
      if (
        incremental.rejectRemovalsAbovePercentage < 0 ||
        incremental.rejectRemovalsAbovePercentage > 100
      ) {
        throw new OpenChoreoIncrementalIngestionError(
          'rejectRemovalsAbovePercentage must be between 0 and 100',
          'INVALID_REMOVAL_THRESHOLD',
        );
      }

      if (incremental.rejectRemovalsAbovePercentage > 50) {
        logger.warn(
          `rejectRemovalsAbovePercentage (${incremental.rejectRemovalsAbovePercentage}%) is very high. This may prevent legitimate removals.`,
        );
      }
    }

    // Validate API configuration
    if (config.openchoreo.api) {
      const { baseUrl } = config.openchoreo.api;

      if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        throw new OpenChoreoIncrementalIngestionError(
          'openchoreo.api.baseUrl must start with http:// or https://',
          'INVALID_API_BASE_URL',
        );
      }

      if (baseUrl.endsWith('/')) {
        logger.warn(
          'openchoreo.api.baseUrl should not end with a slash. Trailing slash will be removed.',
        );
      }
    }
  }

  /**
   * Gets default configuration values.
   *
   * @returns Default configuration object
   */
  static getDefaultConfig(): Partial<OpenChoreoIncrementalConfig> {
    return {
      openchoreo: {
        incremental: {
          burstLength: 10,
          burstInterval: 30,
          restLength: 30,
          chunkSize: 50,
          rejectEmptySourceCollections: false,
          maxConcurrentRequests: 5,
          batchDelayMs: 100,
        },
      },
    };
  }

  /**
   * Merges user configuration with defaults.
   *
   * @param userConfig - User-provided configuration
   * @returns Merged configuration
   */
  static mergeWithDefaults(
    userConfig: Partial<OpenChoreoIncrementalConfig>,
  ): OpenChoreoIncrementalConfig {
    const defaults = this.getDefaultConfig();

    return {
      openchoreo: {
        api: userConfig.openchoreo?.api || defaults.openchoreo?.api,
        incremental: {
          ...defaults.openchoreo!.incremental!,
          ...userConfig.openchoreo?.incremental,
        },
      },
    } as OpenChoreoIncrementalConfig;
  }
}
