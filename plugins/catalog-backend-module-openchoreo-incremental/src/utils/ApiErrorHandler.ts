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

import { LoggerService } from '@backstage/backend-plugin-api';
import { OpenChoreoIncrementalIngestionError } from '../database/errors';

/**
 * Centralized error handler for API operations with consistent retry logic and error classification.
 */
export class ApiErrorHandler {
  private static readonly DEFAULT_MAX_RETRIES = 3;
  private static readonly BASE_DELAY_MS = 1000;
  private static readonly MAX_DELAY_MS = 10000;

  /**
   * Executes an API operation with standardized error handling and retry logic.
   *
   * @param operation - The async operation to execute
   * @param context - Context description for error logging
   * @param logger - Logger service for error reporting
   * @param options - Optional configuration for retry behavior
   * @returns Promise resolving to the operation result
   * @throws OpenChoreoIncrementalIngestionError for non-retryable errors
   */
  static async handleApiCall<T>(
    operation: () => Promise<T>,
    context: string,
    logger: LoggerService,
    options: {
      maxRetries?: number;
      baseDelay?: number;
      maxDelay?: number;
    } = {},
  ): Promise<T> {
    const {
      maxRetries = this.DEFAULT_MAX_RETRIES,
      baseDelay = this.BASE_DELAY_MS,
      maxDelay = this.MAX_DELAY_MS,
    } = options;

    let attempt = 0;
    let lastError: Error | undefined;

    while (attempt <= maxRetries) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on the last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Check if error is retryable
        if (!this.isRetryableError(lastError)) {
          logger.error(
            `Non-retryable error in ${context}: ${lastError.message}`,
            lastError,
          );
          throw new OpenChoreoIncrementalIngestionError(
            `Failed operation in ${context}: ${lastError.message}`,
            'OPERATION_FAILED',
          );
        }

        // Calculate exponential backoff with jitter
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        const jitter = Math.random() * 1000; // Add up to 1 second of jitter
        const totalDelay = delay + jitter;

        logger.warn(
          `Retryable error in ${context} (attempt ${attempt + 1}/${
            maxRetries + 1
          }): ${lastError.message}. Retrying in ${Math.round(totalDelay)}ms`,
        );

        await this.sleep(totalDelay);
        attempt++;
      }
    }

    // All retries exhausted
    logger.error(
      `Operation failed in ${context} after ${maxRetries + 1} attempts: ${
        lastError!.message
      }`,
      lastError,
    );

    throw new OpenChoreoIncrementalIngestionError(
      `Operation failed in ${context} after ${maxRetries + 1} attempts: ${
        lastError!.message
      }`,
      'MAX_RETRIES_EXCEEDED',
    );
  }

  /**
   * Determines if an error is retryable based on its characteristics.
   *
   * @param error - The error to evaluate
   * @returns true if the error is retryable, false otherwise
   */
  private static isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Network-related errors
    if (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('econnreset') ||
      message.includes('enotfound')
    ) {
      return true;
    }

    // HTTP status codes that should be retried
    if (
      message.includes('http 429') || // Rate limiting
      message.includes('http 502') || // Bad gateway
      message.includes('http 503') || // Service unavailable
      message.includes('http 504')
    ) {
      // Gateway timeout
      return true;
    }

    // Database deadlocks and transient errors
    if (
      message.includes('deadlock') ||
      message.includes('connection reset') ||
      message.includes('connection closed') ||
      message.includes('database is locked')
    ) {
      return true;
    }

    // Retryable specific error messages
    if (
      message.includes('too many requests') ||
      message.includes('service temporarily unavailable') ||
      message.includes('try again later')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Sleep utility for retry delays.
   *
   * @param ms - Milliseconds to sleep
   * @returns Promise that resolves after the specified delay
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Enhances an error with additional context information.
   *
   * @param error - The original error
   * @param context - Context description
   * @param additionalInfo - Optional additional context
   * @returns Enhanced error with context
   */
  static enhanceError(
    error: Error,
    context: string,
    additionalInfo?: Record<string, any>,
  ): OpenChoreoIncrementalIngestionError {
    const enhancedMessage = additionalInfo
      ? `${context}: ${error.message} (Context: ${JSON.stringify(
          additionalInfo,
        )})`
      : `${context}: ${error.message}`;

    const enhancedError = new OpenChoreoIncrementalIngestionError(
      enhancedMessage,
      'ENHANCED_ERROR',
    );

    // Preserve original error stack
    enhancedError.stack = error.stack;

    return enhancedError;
  }

  /**
   * Safely parses JSON responses with proper error handling.
   *
   * @param responseText - Raw response text
   * @param context - Context for error reporting
   * @returns Parsed JSON object
   * @throws OpenChoreoIncrementalIngestionError for parsing failures
   */
  static safeJsonParse(responseText: string, context: string): any {
    try {
      return JSON.parse(responseText);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new OpenChoreoIncrementalIngestionError(
        `Failed to parse JSON response in ${context}: ${errorMessage}`,
        'JSON_PARSE_ERROR',
      );
    }
  }

  /**
   * Validates HTTP response status and throws appropriate errors.
   *
   * @param response - Fetch response object
   * @param context - Context for error reporting
   * @throws OpenChoreoIncrementalIngestionError for HTTP errors
   */
  static validateHttpResponse(response: Response, context: string): void {
    if (!response.ok) {
      const statusCode = response.status;
      const statusText = response.statusText;

      throw new OpenChoreoIncrementalIngestionError(
        `HTTP error in ${context}: ${statusCode} ${statusText}`,
        'HTTP_ERROR',
      );
    }
  }
}
