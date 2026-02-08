/**
 * Standalone logger interface for OpenChoreo API clients.
 *
 * Structurally compatible with Backstage LoggerService —
 * existing callers can pass their LoggerService instance without changes.
 *
 * @packageDocumentation
 */

export interface Logger {
  info(message: string): void;
  debug(message: string): void;
  error(message: string): void;
  warn(message: string): void;
}
