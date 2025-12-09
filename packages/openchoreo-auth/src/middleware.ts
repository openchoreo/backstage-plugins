import { Request, RequestHandler } from 'express';
import { OpenChoreoTokenService } from './OpenChoreoTokenService';

/**
 * Symbol key for storing the user token on the request object.
 * Using a symbol prevents collisions with other request properties.
 */
const userTokenSymbol = Symbol('openchoreo-user-token');

/**
 * Request type with the user token property added.
 */
type RequestWithUserToken = Request & {
  [userTokenSymbol]?: string | null;
};

/**
 * Creates middleware that extracts the user's IDP token from request headers
 * and caches it on the request object.
 *
 * This allows routes to access the token efficiently without repeatedly
 * parsing headers. Use `getUserTokenFromRequest()` to retrieve the token.
 *
 * @param tokenService - OpenChoreo token service for extracting tokens
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * router.use(createUserTokenMiddleware(tokenService));
 *
 * router.get('/endpoint', async (req, res) => {
 *   const userToken = getUserTokenFromRequest(req);
 *   // userToken is string | undefined
 * });
 * ```
 */
export function createUserTokenMiddleware(
  tokenService: OpenChoreoTokenService,
): RequestHandler {
  return (req: RequestWithUserToken, _res, next) => {
    // Extract and cache the token (null means "checked but not present")
    req[userTokenSymbol] = tokenService.getUserToken(req) ?? null;
    next();
  };
}

/**
 * Retrieves the user's IDP token from a request that has been processed
 * by the user token middleware.
 *
 * @param req - Express request object (must have been processed by middleware)
 * @returns The user's IDP token, or undefined if not present
 *
 * @example
 * ```typescript
 * router.get('/component', async (req, res) => {
 *   const userToken = getUserTokenFromRequest(req);
 *   res.json(await service.fetchDetails(..., userToken));
 * });
 * ```
 */
export function getUserTokenFromRequest(req: Request): string | undefined {
  const token = (req as RequestWithUserToken)[userTokenSymbol];
  // null means "checked but not present", so return undefined
  // undefined means middleware hasn't run (also return undefined)
  return token === null ? undefined : token;
}
