import { ResponseError } from '@backstage/errors';

/**
 * Checks if an error is a 403 Forbidden response from the backend.
 */
export function isForbiddenError(error: unknown): boolean {
  return error instanceof ResponseError && error.statusCode === 403;
}

/**
 * Checks if an error is a 404 Not Found response from the backend.
 */
export function isNotFoundError(error: unknown): boolean {
  return error instanceof ResponseError && error.statusCode === 404;
}

/**
 * Extracts a human-readable error message from an error object.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ResponseError) {
    // The cause is the deserialized error from the backend with the actual message
    const cause = error.cause as Error | undefined;
    if (cause?.message) {
      return cause.message;
    }
    // Fallback to body fields
    const body = error.body as
      | { error?: { message?: string }; message?: string }
      | undefined;
    return body?.error?.message || body?.message || error.message;
  }
  return error instanceof Error ? error.message : 'An unknown error occurred';
}
