/**
 * Network call tracing middleware for OpenChoreo API clients
 *
 * Enable tracing by setting the CHOREO_CLIENT_TRACE_ENABLED environment variable to 'true' or '1'.
 *
 * @packageDocumentation
 */

import type { Middleware } from 'openapi-fetch';
import type { LoggerService } from '@backstage/backend-plugin-api';

/** Environment variable name to enable/disable tracing */
export const TRACE_ENV_VAR = 'CHOREO_CLIENT_TRACE_ENABLED';

/** Headers that should be redacted in trace output for security */
const SENSITIVE_HEADERS = ['authorization', 'x-original-authorization'];

/** Maximum body length before truncation (10KB) */
const MAX_BODY_LENGTH = 10000;

/**
 * Checks if tracing is enabled via environment variable
 *
 * @returns true if CHOREO_CLIENT_TRACE_ENABLED is set to 'true' or '1'
 */
export function isTracingEnabled(): boolean {
  const value = process.env[TRACE_ENV_VAR];
  return value === 'true' || value === '1';
}

/**
 * Creates a tracing middleware that logs HTTP requests and responses
 *
 * @param logger - Optional logger service. Falls back to console if not provided.
 * @returns Middleware object compatible with openapi-fetch
 *
 * @example
 * ```typescript
 * const client = createClient<paths>({ baseUrl: 'https://api.example.com' });
 * client.use(createTracingMiddleware(logger));
 * ```
 */
export function createTracingMiddleware(logger?: LoggerService): Middleware {
  return {
    async onRequest({ request, schemaPath }) {
      if (!isTracingEnabled()) return undefined;

      const startTime = Date.now();
      // Store start time on request for response timing calculation
      (request as Request & { __traceStartTime?: number }).__traceStartTime =
        startTime;

      // Clone request to read body without consuming it
      const body = await request.clone().text();

      const logMessage = formatRequestLog(request, schemaPath, body);
      if (logger) {
        logger.info(logMessage);
      } else {
        console.log(logMessage);
      }

      return undefined;
    },

    async onResponse({ request, response }) {
      if (!isTracingEnabled()) return undefined;

      const startTime =
        (request as Request & { __traceStartTime?: number }).__traceStartTime ||
        Date.now();
      const duration = Date.now() - startTime;

      // Clone response to read body without consuming it
      const body = await response.clone().text();

      const logMessage = formatResponseLog(response, body, duration);
      if (logger) {
        logger.info(logMessage);
      } else {
        console.log(logMessage);
      }

      return undefined;
    },

    async onError({ request, error }) {
      if (!isTracingEnabled()) return undefined;

      const startTime =
        (request as Request & { __traceStartTime?: number }).__traceStartTime ||
        Date.now();
      const duration = Date.now() - startTime;

      const logMessage = `[CHOREO-TRACE] ✗ ERROR (${duration}ms)\n  ${error}`;
      if (logger) {
        logger.error(logMessage);
      } else {
        console.error(logMessage);
      }

      return undefined;
    },
  };
}

/**
 * Formats a request for trace logging
 */
function formatRequestLog(
  request: Request,
  schemaPath: string,
  body: string,
): string {
  const headers = formatHeaders(request.headers);
  const truncatedBody = truncateBody(body);
  const headersJson = JSON.stringify(headers, null, 2)
    .split('\n')
    .join('\n    ');

  return `[CHOREO-TRACE] ▶ REQUEST
  Method: ${request.method}
  URL: ${request.url}
  Path: ${schemaPath}
  Headers: ${headersJson}
  Body: ${truncatedBody || '(empty)'}`;
}

/**
 * Formats a response for trace logging
 */
function formatResponseLog(
  response: Response,
  body: string,
  duration: number,
): string {
  const headers = formatHeaders(response.headers);
  const truncatedBody = truncateBody(body);
  const headersJson = JSON.stringify(headers, null, 2)
    .split('\n')
    .join('\n    ');

  return `[CHOREO-TRACE] ◀ RESPONSE (${duration}ms)
  Status: ${response.status} ${response.statusText}
  Headers: ${headersJson}
  Body: ${truncatedBody || '(empty)'}`;
}

/**
 * Converts Headers object to a plain object, redacting sensitive values
 */
function formatHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = SENSITIVE_HEADERS.includes(key.toLowerCase())
      ? '[REDACTED]'
      : value;
  });
  return result;
}

/**
 * Truncates body content if it exceeds the maximum length
 */
function truncateBody(body: string, maxLength = MAX_BODY_LENGTH): string {
  if (!body) return '';
  if (body.length <= maxLength) return body;
  return `${body.substring(0, maxLength)}... [truncated, ${
    body.length
  } total bytes]`;
}
