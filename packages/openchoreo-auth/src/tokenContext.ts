import { AsyncLocalStorage } from 'async_hooks';

/**
 * Context for storing OpenChoreo user token during async operations.
 * This allows the token to be accessed anywhere in the request lifecycle
 * without explicitly passing it through every function call.
 */
export interface OpenChoreoTokenContext {
  /** The user's OpenChoreo IDP token */
  userToken?: string;
}

/**
 * AsyncLocalStorage instance for token context.
 * @internal
 */
const tokenStorage = new AsyncLocalStorage<OpenChoreoTokenContext>();

/**
 * Executes a function within a token context.
 *
 * This is primarily used by middleware to establish the token context
 * at the start of a request, making the token available to any code
 * that runs during that request (including the permission policy).
 *
 * @param context - The token context to establish
 * @param fn - The function to execute within the context
 * @returns The result of the function
 *
 * @example
 * ```typescript
 * // In middleware
 * const userToken = extractTokenFromRequest(req);
 * return runWithTokenContext({ userToken }, () => {
 *   return next();
 * });
 * ```
 */
export function runWithTokenContext<T>(
  context: OpenChoreoTokenContext,
  fn: () => T,
): T {
  return tokenStorage.run(context, fn);
}

/**
 * Retrieves the current token context.
 *
 * This can be called from anywhere during a request to get the user's
 * OpenChoreo token without needing direct access to the Express request.
 *
 * Returns undefined if called outside of a token context (e.g., during
 * background tasks or before middleware has run).
 *
 * @returns The current token context, or undefined if not in a context
 *
 * @example
 * ```typescript
 * // In a permission policy or service
 * const context = getTokenContext();
 * const userToken = context?.userToken;
 * if (userToken) {
 *   // Make authenticated API call
 * }
 * ```
 */
export function getTokenContext(): OpenChoreoTokenContext | undefined {
  return tokenStorage.getStore();
}

/**
 * Convenience function to get just the user token from the current context.
 *
 * @returns The user's OpenChoreo token, or undefined if not available
 *
 * @example
 * ```typescript
 * const token = getUserTokenFromContext();
 * if (token) {
 *   await callOpenChoreoApi(token);
 * }
 * ```
 */
export function getUserTokenFromContext(): string | undefined {
  return tokenStorage.getStore()?.userToken;
}
