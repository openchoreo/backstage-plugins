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
 * Test suite for the zod configuration schemas.
 * Verifies default values, partial inputs, type enforcement, optional keys,
 * and the API and top-level validation schemas.
 */
import { ZodError } from 'zod';
import {
  openchoreoApiConfigSchema,
  openchoreoIncrementalConfigSchema,
  openchoreoIncrementalConfigValidation,
} from './config';

describe('openchoreoIncrementalConfigSchema', () => {
  it('fills in all defaults for an empty object', () => {
    expect(openchoreoIncrementalConfigSchema.parse({})).toEqual({
      burstLength: 10,
      burstInterval: 30,
      restLength: 30,
      chunkSize: 100,
      rejectEmptySourceCollections: false,
      maxConcurrentRequests: 5,
      batchDelayMs: 100,
    });
  });

  it('accepts partial objects and merges them with the defaults', () => {
    expect(
      openchoreoIncrementalConfigSchema.parse({
        burstLength: 60,
        restLength: 5,
      }),
    ).toEqual({
      burstLength: 60,
      burstInterval: 30,
      restLength: 5,
      chunkSize: 100,
      rejectEmptySourceCollections: false,
      maxConcurrentRequests: 5,
      batchDelayMs: 100,
    });
  });

  it('rejects wrong types for every tuned field', () => {
    expect(() =>
      openchoreoIncrementalConfigSchema.parse({ burstLength: 'ten' }),
    ).toThrow(ZodError);
    expect(() =>
      openchoreoIncrementalConfigSchema.parse({ burstInterval: true }),
    ).toThrow(ZodError);
    expect(() =>
      openchoreoIncrementalConfigSchema.parse({ restLength: null }),
    ).toThrow(ZodError);
    expect(() =>
      openchoreoIncrementalConfigSchema.parse({ chunkSize: '100' }),
    ).toThrow(ZodError);
    expect(() =>
      openchoreoIncrementalConfigSchema.parse({
        rejectEmptySourceCollections: 'yes',
      }),
    ).toThrow(ZodError);
    expect(() =>
      openchoreoIncrementalConfigSchema.parse({ backoff: [10, 'x'] }),
    ).toThrow(ZodError);
    expect(() =>
      openchoreoIncrementalConfigSchema.parse({
        maxConcurrentRequests: '5',
      }),
    ).toThrow(ZodError);
  });

  it('enforces the documented ranges', () => {
    expect(() =>
      openchoreoIncrementalConfigSchema.parse({ chunkSize: 101 }),
    ).toThrow(ZodError);
    expect(() =>
      openchoreoIncrementalConfigSchema.parse({ burstInterval: 4 }),
    ).toThrow(ZodError);
    expect(() =>
      openchoreoIncrementalConfigSchema.parse({ restLength: 1441 }),
    ).toThrow(ZodError);

    // The boundary values themselves are accepted.
    expect(
      openchoreoIncrementalConfigSchema.parse({
        chunkSize: 100,
        burstInterval: 300,
        restLength: 1440,
      }),
    ).toMatchObject({
      chunkSize: 100,
      burstInterval: 300,
      restLength: 1440,
    });
  });

  it('keeps backoff and rejectRemovalsAbovePercentage optional', () => {
    const withoutOptionals = openchoreoIncrementalConfigSchema.parse({});
    expect(withoutOptionals.backoff).toBeUndefined();
    expect(withoutOptionals.rejectRemovalsAbovePercentage).toBeUndefined();

    const withOptionals = openchoreoIncrementalConfigSchema.parse({
      backoff: [30, 60, 300],
      rejectRemovalsAbovePercentage: 25,
    });
    expect(withOptionals.backoff).toEqual([30, 60, 300]);
    expect(withOptionals.rejectRemovalsAbovePercentage).toBe(25);

    expect(() =>
      openchoreoIncrementalConfigSchema.parse({
        rejectRemovalsAbovePercentage: 101,
      }),
    ).toThrow(ZodError);
    expect(() =>
      openchoreoIncrementalConfigSchema.parse({ backoff: [0] }),
    ).toThrow(ZodError);
  });
});

describe('openchoreoApiConfigSchema', () => {
  it('requires a valid base URL and keeps the token optional', () => {
    expect(() => openchoreoApiConfigSchema.parse({})).toThrow(ZodError);

    expect(
      openchoreoApiConfigSchema.parse({
        baseUrl: 'https://api.openchoreo.example.com',
      }),
    ).toEqual({ baseUrl: 'https://api.openchoreo.example.com' });

    expect(
      openchoreoApiConfigSchema.parse({
        baseUrl: 'http://localhost:8080',
        token: 'secret',
      }),
    ).toEqual({ baseUrl: 'http://localhost:8080', token: 'secret' });

    expect(() =>
      openchoreoApiConfigSchema.parse({ baseUrl: 'not a url' }),
    ).toThrow(ZodError);
  });
});

describe('openchoreoIncrementalConfigValidation', () => {
  it('requires an openchoreo section but accepts it empty', () => {
    expect(() => openchoreoIncrementalConfigValidation.parse({})).toThrow(
      ZodError,
    );
    expect(
      openchoreoIncrementalConfigValidation.parse({ openchoreo: {} }),
    ).toEqual({ openchoreo: {} });
  });

  it('validates api and incremental sections together', () => {
    expect(
      openchoreoIncrementalConfigValidation.parse({
        openchoreo: {
          api: { baseUrl: 'https://api.openchoreo.example.com' },
          incremental: { burstLength: 20 },
        },
      }),
    ).toEqual({
      openchoreo: {
        api: { baseUrl: 'https://api.openchoreo.example.com' },
        incremental: {
          burstLength: 20,
          burstInterval: 30,
          restLength: 30,
          chunkSize: 100,
          rejectEmptySourceCollections: false,
          maxConcurrentRequests: 5,
          batchDelayMs: 100,
        },
      },
    });

    expect(() =>
      openchoreoIncrementalConfigValidation.parse({
        openchoreo: { incremental: { burstLength: 301 } },
      }),
    ).toThrow(ZodError);
  });
});
