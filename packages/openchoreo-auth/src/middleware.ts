import { Request, Response, NextFunction, RequestHandler } from 'express';
import { AuthenticationError } from '@backstage/errors';
import { OpenChoreoTokenService } from './OpenChoreoTokenService';
import { runWithTokenContext } from './tokenContext';

/**
 * Cookie name used to store the OpenChoreo IDP token.
 * This must match the cookie name used in the auth module's IdpTokenCookieManager.
 */
export const OPENCHOREO_IDP_TOKEN_COOKIE = 'openchoreo-idp-token';

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
 * This middleware also establishes a token context using AsyncLocalStorage,
 * making the token accessible to any code that runs during the request
 * (including permission policies) without explicitly passing the request object.
 *
 * Use `getUserTokenFromRequest()` to retrieve the token from the request,
 * or `getUserTokenFromContext()` to retrieve it from anywhere in the request lifecycle.
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
    // Extract the token (null means "checked but not present")
    const userToken = tokenService.getUserToken(req) ?? null;
    req[userTokenSymbol] = userToken;

    // Wrap the rest of the request in a token context
    // This makes the token available via getTokenContext() anywhere in the request
    runWithTokenContext({ userToken: userToken ?? undefined }, () => {
      next();
    });
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

/**
 * Creates middleware that requires authentication for mutating operations.
 *
 * When auth is enabled (openchoreo.features.auth.enabled=true), this middleware
 * checks for a valid user token on the request. If no token is present, it rejects
 * the request with a 401 Unauthorized error.
 *
 * When auth is disabled (guest mode), requests are allowed through without token validation.
 * This prevents guest users from accidentally triggering mutations when auth was
 * intentionally disabled.
 *
 * @param tokenService - OpenChoreo token service for extracting tokens
 * @param authEnabled - Whether authentication is enabled (from config)
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * const requireAuth = createRequireAuthMiddleware(tokenService, authEnabled);
 *
 * // Apply to mutating routes
 * router.post('/create-release', requireAuth, async (req, res) => {
 *   // Only authenticated users reach here when auth is enabled
 * });
 * ```
 */
export function createRequireAuthMiddleware(
  tokenService: OpenChoreoTokenService,
  authEnabled: boolean,
): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    // When auth is disabled (guest mode), allow all requests
    if (!authEnabled) {
      return next();
    }

    // When auth is enabled, require a valid user token
    const userToken = tokenService.getUserToken(req);
    if (!userToken) {
      throw new AuthenticationError(
        'Authentication required for this operation. Please sign in to continue.',
      );
    }

    return next();
  };
}

/**
 * Creates middleware that reads the OpenChoreo IDP token from cookies and
 * establishes a token context using AsyncLocalStorage.
 *
 * This middleware is designed to be applied at the root HTTP router level,
 * before any route handlers. It reads the IDP token from the cookie that
 * was set during authentication (by the auth module's IdpTokenCookieManager)
 * and makes it available to ALL routes via `getUserTokenFromContext()`.
 *
 * This is critical for the permission system, which needs access to the
 * user's IDP token to query the OpenChoreo /authz/profile API, but doesn't
 * have direct access to the request object.
 *
 * Token priority:
 * 1. Cookie (openchoreo-idp-token) - set by auth module
 * 2. Header (x-openchoreo-token) - set by frontend for direct API calls
 *
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * // In backend/src/index.ts
 * backend.add(rootHttpRouterServiceFactory({
 *   configure: ({ app, applyDefaults, middleware }) => {
 *     app.use(middleware.helmet());
 *     app.use(middleware.cors());
 *     app.use(express.json());
 *     app.use(cookieParser());
 *     app.use(createIdpTokenCookieMiddleware()); // Add before routes
 *     applyDefaults();
 *   }
 * }));
 * ```
 */
export function createIdpTokenCookieMiddleware(): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    // Priority: cookie > header
    let userToken: string | undefined;

    // Try to get token from cookie (set by auth module during login)
    const cookieToken = req.cookies?.[OPENCHOREO_IDP_TOKEN_COOKIE];
    if (typeof cookieToken === 'string' && cookieToken.length > 0) {
      userToken = cookieToken;
    }

    // Fallback to header (set by frontend for direct API calls)
    if (!userToken) {
      const headerToken = req.headers['x-openchoreo-token'];
      if (typeof headerToken === 'string' && headerToken.length > 0) {
        userToken = headerToken;
      }
    }

    // Wrap the rest of the request in a token context
    // This makes the token available via getUserTokenFromContext() anywhere
    runWithTokenContext({ userToken }, () => {
      next();
    });
  };
}
