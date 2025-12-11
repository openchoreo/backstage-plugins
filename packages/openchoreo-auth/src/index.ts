/**
 * OpenChoreo authentication service package.
 *
 * Provides token management for OpenChoreo API integration:
 * - User token extraction from request headers
 * - Service token acquisition via OAuth2 client credentials
 * - Middleware for automatic token extraction
 *
 * @packageDocumentation
 */

export type { OpenChoreoTokenService } from './OpenChoreoTokenService';
export {
  DefaultOpenChoreoTokenService,
  openChoreoTokenServiceRef,
} from './OpenChoreoTokenService';
export { NoOpTokenService } from './NoOpTokenService';

export { ClientCredentialsProvider } from './ClientCredentialsProvider';

export {
  createUserTokenMiddleware,
  getUserTokenFromRequest,
} from './middleware';

export type { OpenChoreoAuthConfig, CachedToken, TokenResponse } from './types';
export { OPENCHOREO_TOKEN_HEADER } from './types';
