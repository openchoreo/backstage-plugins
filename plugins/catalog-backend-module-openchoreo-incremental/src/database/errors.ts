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

export class DatabaseTransactionError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'DatabaseTransactionError';
  }
}

export class DeadlockError extends DatabaseTransactionError {
  constructor(operation: string, cause?: Error) {
    super('Transaction deadlock detected', operation, cause);
    this.name = 'DeadlockError';
  }
}

export class ConstraintViolationError extends DatabaseTransactionError {
  constructor(
    message: string,
    operation: string,
    public readonly constraintName?: string,
    cause?: Error,
  ) {
    super(message, operation, cause);
    this.name = 'ConstraintViolationError';
  }
}

export class TransientDatabaseError extends DatabaseTransactionError {
  constructor(operation: string, cause?: Error) {
    super('Transient database error - retry possible', operation, cause);
    this.name = 'TransientDatabaseError';
  }
}

export class OpenChoreoIncrementalIngestionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'OpenChoreoIncrementalIngestionError';
  }
}
