import { ResponseError } from '@backstage/errors';

/**
 * Checks if an error is a 403 Forbidden response from the backend.
 */
export function isForbiddenError(error: unknown): boolean {
  return error instanceof ResponseError && error.statusCode === 403;
}

/**
 * Extracts a human-readable error message from an error object.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ResponseError) {
    const body = error.body as
      | { error?: { message?: string }; message?: string }
      | undefined;
    return body?.error?.message || body?.message || error.message;
  }
  return error instanceof Error ? error.message : 'An unknown error occurred';
}
