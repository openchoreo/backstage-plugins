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
 * Tries to extract a detail message from embedded JSON in a string.
 *
 * Backstage's ResponseError wraps non-standard error bodies into a synthetic
 * message like: "Request failed with status 400 Bad Request, {"error":{"message":"..."}}"
 * This function extracts the actual detail from the embedded JSON.
 */
function extractDetailFromEmbeddedJson(text: string): string | undefined {
  const jsonStart = text.indexOf('{');
  if (jsonStart === -1) return undefined;
  try {
    const parsed = JSON.parse(text.substring(jsonStart));
    if (typeof parsed.error === 'string') return parsed.error;
    if (parsed.error?.message) return parsed.error.message;
    if (parsed.message) return parsed.message;
  } catch {
    // Not valid JSON
  }
  return undefined;
}

/**
 * Extracts a human-readable error message from an error object.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ResponseError) {
    // The cause message often contains the actual detail, but when the backend
    // response doesn't match Backstage's expected { error, response } format,
    // Backstage wraps the raw body into the cause message as:
    // "Request failed with status 400 Bad Request, <raw JSON body>"
    // Try to extract the real detail from that embedded JSON.
    const cause = error.cause as Error | undefined;
    const source = cause?.message || '';
    const detail = extractDetailFromEmbeddedJson(source);
    if (detail) {
      return `Request failed with ${error.statusCode}: ${detail}`;
    }
    // If cause message has no embedded JSON but is different from the
    // top-level message, use it directly as the detail.
    if (cause?.message && cause.message !== error.message) {
      return cause.message;
    }
    return error.message;
  }
  return error instanceof Error ? error.message : 'An unknown error occurred';
}
