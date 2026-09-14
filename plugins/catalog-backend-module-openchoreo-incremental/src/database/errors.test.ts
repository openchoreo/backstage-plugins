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
 * Test suite for the database error taxonomy.
 * Verifies class hierarchy, error names, message formatting, and the
 * operation/cause/constraint metadata each error class carries.
 */
import {
  ConstraintViolationError,
  DatabaseTransactionError,
  DeadlockError,
  OpenChoreoIncrementalIngestionError,
  TransientDatabaseError,
} from './errors';

describe('database errors', () => {
  it('formats DatabaseTransactionError with operation and cause', () => {
    const cause = new Error('connection reset');
    const error = new DatabaseTransactionError(
      'Transaction failed: connection reset',
      'updateIngestionRecordById(ingestionId=abc)',
      cause,
    );

    expect(error).toBeInstanceOf(DatabaseTransactionError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('DatabaseTransactionError');
    expect(error.message).toBe('Transaction failed: connection reset');
    expect(error.operation).toBe('updateIngestionRecordById(ingestionId=abc)');
    expect(error.cause).toBe(cause);
  });

  it('allows DatabaseTransactionError without a cause', () => {
    const error = new DatabaseTransactionError('boom', 'purgeTable');
    expect(error.cause).toBeUndefined();
    expect(error.operation).toBe('purgeTable');
  });

  it('formats DeadlockError with the fixed message', () => {
    const cause = new Error('deadlock victim');
    const error = new DeadlockError('clearFinishedIngestions', cause);

    expect(error).toBeInstanceOf(DatabaseTransactionError);
    expect(error.name).toBe('DeadlockError');
    expect(error.message).toBe('Transaction deadlock detected');
    expect(error.operation).toBe('clearFinishedIngestions');
    expect(error.cause).toBe(cause);
  });

  it('formats ConstraintViolationError with the constraint name', () => {
    const cause = new Error('duplicate key');
    const error = new ConstraintViolationError(
      'Unique constraint violation',
      'insertIngestionRecord',
      'ingestion_composite_index',
      cause,
    );

    expect(error).toBeInstanceOf(DatabaseTransactionError);
    expect(error.name).toBe('ConstraintViolationError');
    expect(error.message).toBe('Unique constraint violation');
    expect(error.operation).toBe('insertIngestionRecord');
    expect(error.constraintName).toBe('ingestion_composite_index');
    expect(error.cause).toBe(cause);

    const withoutConstraint = new ConstraintViolationError(
      'Foreign key constraint violation',
      'createMark',
    );
    expect(withoutConstraint.constraintName).toBeUndefined();
  });

  it('formats TransientDatabaseError with the fixed message', () => {
    const cause = new Error('ETIMEDOUT');
    const error = new TransientDatabaseError('healthcheck', cause);

    expect(error).toBeInstanceOf(DatabaseTransactionError);
    expect(error.name).toBe('TransientDatabaseError');
    expect(error.message).toBe('Transient database error - retry possible');
    expect(error.operation).toBe('healthcheck');
    expect(error.cause).toBe(cause);
  });

  it('formats OpenChoreoIncrementalIngestionError with a code', () => {
    const cause = new Error('boom');
    const error = new OpenChoreoIncrementalIngestionError(
      'Failed to validate configuration',
      'CONFIG_VALIDATION_ERROR',
      cause,
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('OpenChoreoIncrementalIngestionError');
    expect(error.message).toBe('Failed to validate configuration');
    expect(error.code).toBe('CONFIG_VALIDATION_ERROR');
    expect(error.cause).toBe(cause);

    const withoutCause = new OpenChoreoIncrementalIngestionError(
      'Something failed',
      'UNKNOWN',
    );
    expect(withoutCause.cause).toBeUndefined();
  });
});
