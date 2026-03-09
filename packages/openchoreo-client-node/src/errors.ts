import {
  InputError,
  NotAllowedError,
  NotFoundError,
  ConflictError,
  AuthenticationError,
} from '@backstage/errors';

/**
 * Extracts a human-readable error message from an OpenChoreo API error response.
 *
 * OpenChoreo error responses typically have the shape:
 *   { error: string, code: string }
 * or nested:
 *   { error: { message: string } }
 * or openapi-fetch error objects:
 *   { message: string }
 */
export function extractErrorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const errObj = error as Record<string, unknown>;

  // Direct message field
  if (typeof errObj.message === 'string') {
    return errObj.message;
  }

  // Direct error field (string)
  if (typeof errObj.error === 'string') {
    return errObj.error;
  }

  // Nested error object with message
  if (errObj.error && typeof errObj.error === 'object') {
    const nested = errObj.error as Record<string, unknown>;
    if (typeof nested.message === 'string') {
      return nested.message;
    }
  }

  return undefined;
}

/**
 * Type-narrowing assertion that inspects an openapi-fetch result tuple
 * and throws the appropriate Backstage error class based on HTTP status code.
 *
 * After this call, `result.data` is guaranteed to be defined.
 *
 * @param result - The openapi-fetch response tuple `{ data, error, response }`
 * @param context - A short description of the operation, e.g. "fetch environments"
 *
 * @example
 * ```ts
 * const result = await client.GET('/api/v1/namespaces/{ns}/environments', { ... });
 * assertApiResponse(result, 'fetch environments');
 * // result.data is now T (non-undefined)
 * ```
 */
export function assertApiResponse<T>(
  result: { data?: T; error?: unknown; response: Response },
  context: string,
): asserts result is { data: T; error: undefined; response: Response } {
  if (!result.error && result.response.ok) return;

  const message =
    extractErrorMessage(result.error) ??
    `Failed to ${context}: ${result.response.status} ${result.response.statusText}`;

  switch (result.response.status) {
    case 400:
      throw new InputError(message);
    case 401:
      throw new AuthenticationError(message);
    case 403:
      throw new NotAllowedError(message);
    case 404:
      throw new NotFoundError(message);
    case 409:
      throw new ConflictError(message);
    default:
      throw new Error(
        `Failed to ${context}: ${result.response.status} ${result.response.statusText}`,
      );
  }
}

/**
 * Same as `assertApiResponse` but returns data directly, useful when
 * the result has already been destructured into `{ data, error, response }`.
 *
 * @example
 * ```ts
 * const { data, error, response } = await client.GET('/api/v1/...');
 * const result = requireApiResponse({ data, error, response }, 'fetch X');
 * // result is now T (non-undefined)
 * ```
 */
export function requireApiResponse<T>(
  result: { data?: T; error?: unknown; response: Response },
  context: string,
): T {
  assertApiResponse(result, context);
  return result.data;
}
