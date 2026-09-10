/*
 * Copyright 2023 The Backstage Authors
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
 * Test suite for ConfigValidator.
 * Verifies full-config validation, per-field range enforcement, defaults for
 * absent sections, and the business-rule checks layered on top of the zod
 * schema. Field-level failures are surfaced through the wrapped ZodError
 * cause of OpenChoreoIncrementalIngestionError.
 */
import { mockServices } from '@backstage/backend-test-utils';
import { ConfigReader } from '@backstage/config';
import { ZodError } from 'zod';
import { OpenChoreoIncrementalIngestionError } from '../database/errors';
import { ConfigValidator } from './ConfigValidator';

const VALID_INCREMENTAL_CONFIG = {
  burstLength: 10,
  burstInterval: 30,
  restLength: 30,
  chunkSize: 100,
  rejectRemovalsAbovePercentage: 20,
  rejectEmptySourceCollections: true,
  maxConcurrentRequests: 5,
  batchDelayMs: 100,
};

function makeConfig(incrementalOverrides: Record<string, unknown> = {}) {
  return new ConfigReader({
    openchoreo: {
      api: {
        baseUrl: 'https://api.openchoreo.example.com',
        token: 'secret-token',
      },
      incremental: {
        ...VALID_INCREMENTAL_CONFIG,
        ...incrementalOverrides,
      },
    },
  });
}

/** Extracts the offending leaf field name from the wrapped ZodError cause. */
function zodIssuePath(error: unknown): string {
  const cause = (error as OpenChoreoIncrementalIngestionError).cause;
  expect(cause).toBeInstanceOf(ZodError);
  const issues = (cause as ZodError).issues;
  expect(issues.length).toBeGreaterThan(0);
  const path = issues[0].path;
  return String(path[path.length - 1]);
}

describe('ConfigValidator', () => {
  const logger = mockServices.logger.mock();

  it('accepts a valid full configuration', () => {
    const result = ConfigValidator.validateConfig(makeConfig(), logger);

    expect(result).toEqual({
      openchoreo: {
        api: {
          baseUrl: 'https://api.openchoreo.example.com',
          token: 'secret-token',
        },
        incremental: {
          burstLength: 10,
          burstInterval: 30,
          restLength: 30,
          chunkSize: 100,
          rejectRemovalsAbovePercentage: 20,
          rejectEmptySourceCollections: true,
          maxConcurrentRequests: 5,
          batchDelayMs: 100,
        },
      },
    });
  });

  it.each([
    ['chunkSize', 101],
    ['burstLength', 0],
    ['burstInterval', 4],
    ['restLength', 1441],
    ['maxConcurrentRequests', 51],
    ['batchDelayMs', 10_001],
  ])(
    'rejects an out-of-range %s and names the field via the zod cause',
    (field, value) => {
      let thrown: unknown;
      try {
        ConfigValidator.validateConfig(makeConfig({ [field]: value }), logger);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(OpenChoreoIncrementalIngestionError);
      const error = thrown as OpenChoreoIncrementalIngestionError;
      expect(error.name).toBe('OpenChoreoIncrementalIngestionError');
      expect(error.code).toBe('CONFIG_VALIDATION_ERROR');
      expect(error.message).toContain('Configuration validation failed');
      expect(zodIssuePath(error)).toBe(field);
    },
  );

  it('rejects values the config layer cannot convert', () => {
    expect(() =>
      ConfigValidator.validateConfig(
        makeConfig({ burstLength: 'ten' }),
        logger,
      ),
    ).toThrow(
      expect.objectContaining({
        code: 'CONFIG_VALIDATION_ERROR',
        message: expect.stringContaining('Unable to convert'),
      }),
    );
    expect(() =>
      ConfigValidator.validateConfig(
        makeConfig({ maxConcurrentRequests: 'many' }),
        logger,
      ),
    ).toThrow(OpenChoreoIncrementalIngestionError);
  });

  it('yields an empty openchoreo section when nothing is configured', () => {
    const result = ConfigValidator.validateConfig(new ConfigReader({}), logger);
    expect(result).toEqual({ openchoreo: {} });
  });

  it('applies schema defaults when the incremental section is empty', () => {
    const result = ConfigValidator.validateConfig(
      new ConfigReader({ openchoreo: { incremental: {} } }),
      logger,
    );

    expect(result.openchoreo.incremental).toEqual({
      burstLength: 10,
      burstInterval: 30,
      restLength: 30,
      chunkSize: 100,
      rejectEmptySourceCollections: false,
      maxConcurrentRequests: 5,
      batchDelayMs: 100,
    });
  });

  // Business-rule failures keep their own error code; validateConfig no
  // longer re-wraps them as CONFIG_VALIDATION_ERROR (which swallowed it).
  it('rejects burst lengths that are not shorter than the burst interval', () => {
    expect(() =>
      ConfigValidator.validateConfig(
        makeConfig({ burstLength: 30, burstInterval: 30 }),
        logger,
      ),
    ).toThrow(
      expect.objectContaining({
        code: 'INVALID_BURST_TIMING',
        message: expect.stringContaining('burstLength'),
      }),
    );
  });

  it('rejects non-http API base URLs that still parse as URLs', () => {
    expect(() =>
      ConfigValidator.validateConfig(
        new ConfigReader({
          openchoreo: {
            api: { baseUrl: 'ftp://api.openchoreo.example.com' },
            // The API base URL rule is only reached once an incremental
            // section is present.
            incremental: {},
          },
        }),
        logger,
      ),
    ).toThrow(
      expect.objectContaining({
        code: 'INVALID_API_BASE_URL',
        message: expect.stringContaining('http://'),
      }),
    );
  });

  it('exposes defaults and merges user overrides', () => {
    const defaults = ConfigValidator.getDefaultConfig();
    expect(defaults.openchoreo!.incremental).toMatchObject({
      burstLength: 10,
      burstInterval: 30,
      restLength: 30,
      chunkSize: 50,
      maxConcurrentRequests: 5,
    });

    const merged = ConfigValidator.mergeWithDefaults({
      openchoreo: {
        incremental: { ...VALID_INCREMENTAL_CONFIG, chunkSize: 25 },
      },
    });
    expect(merged.openchoreo.incremental).toEqual({
      burstLength: 10,
      burstInterval: 30,
      restLength: 30,
      chunkSize: 25,
      rejectRemovalsAbovePercentage: 20,
      rejectEmptySourceCollections: true,
      maxConcurrentRequests: 5,
      batchDelayMs: 100,
    });
  });
});
