import { Request } from 'express';
import {
  coreServices,
  createServiceFactory,
  createServiceRef,
  LoggerService,
} from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';
import { AuthenticationError } from '@backstage/errors';
import { ClientCredentialsProvider } from './ClientCredentialsProvider';
import { OPENCHOREO_TOKEN_HEADER, OpenChoreoAuthConfig } from './types';

/**
 * Service for managing OpenChoreo API authentication tokens.
 *
 * Supports two token acquisition methods:
 * 1. User tokens - extracted from request headers (for user-initiated requests)
 * 2. Service tokens - obtained via OAuth2 client credentials (for background tasks)
 */
export interface OpenChoreoTokenService {
  /**
   * Extracts the user's IDP access token from the request headers.
   * Returns undefined if no token is present.
   *
   * @param req - Express request object
   * @returns The user's IDP access token, or undefined
   */
  getUserToken(req: Request): string | undefined;

  /**
   * Extracts the user's IDP access token from the request headers.
   * Throws an error if no token is present.
   *
   * @param req - Express request object
   * @returns The user's IDP access token
   * @throws AuthenticationError if no token is present
   */
  getUserTokenRequired(req: Request): string;

  /**
   * Gets a service account token for background tasks.
   * Uses OAuth2 client credentials grant flow.
   * Tokens are cached and automatically refreshed.
   *
   * @returns A valid access token for OpenChoreo API
   * @throws Error if client credentials are not configured or token acquisition fails
   */
  getServiceToken(): Promise<string>;

  /**
   * Checks if client credentials are configured.
   * @returns true if service tokens can be obtained
   */
  hasServiceCredentials(): boolean;
}

/**
 * Default implementation of OpenChoreoTokenService.
 */
export class DefaultOpenChoreoTokenService implements OpenChoreoTokenService {
  private readonly clientCredentialsProvider?: ClientCredentialsProvider;

  constructor(logger: LoggerService, authConfig?: OpenChoreoAuthConfig) {
    if (authConfig) {
      this.clientCredentialsProvider = new ClientCredentialsProvider(
        authConfig,
        logger,
      );
    }
  }

  getUserToken(req: Request): string | undefined {
    const token = req.headers[OPENCHOREO_TOKEN_HEADER];
    if (typeof token === 'string' && token.length > 0) {
      return token;
    }
    return undefined;
  }

  getUserTokenRequired(req: Request): string {
    const token = this.getUserToken(req);
    if (!token) {
      throw new AuthenticationError(
        `Missing ${OPENCHOREO_TOKEN_HEADER} header. User must be authenticated to perform this action.`,
      );
    }
    return token;
  }

  async getServiceToken(): Promise<string> {
    if (!this.clientCredentialsProvider) {
      throw new Error(
        'OpenChoreo client credentials not configured. ' +
          'Please configure openchoreo.auth.clientId, clientSecret, and tokenUrl in app-config.yaml',
      );
    }
    return this.clientCredentialsProvider.getToken();
  }

  hasServiceCredentials(): boolean {
    return !!this.clientCredentialsProvider;
  }
}

/**
 * Service reference for OpenChoreoTokenService.
 * Use this to inject the service into backend plugins.
 */
export const openChoreoTokenServiceRef =
  createServiceRef<OpenChoreoTokenService>({
    id: 'openchoreo.token',
    defaultFactory: async service =>
      createServiceFactory({
        service,
        deps: {
          logger: coreServices.logger,
          config: coreServices.rootConfig,
        },
        async factory({ logger, config }) {
          const authConfig = readOpenChoreoAuthConfig(config);
          return new DefaultOpenChoreoTokenService(logger, authConfig);
        },
      }),
  });

/**
 * Reads OpenChoreo auth configuration from Backstage config.
 * Returns undefined if auth is not configured.
 */
function readOpenChoreoAuthConfig(
  config: Config,
): OpenChoreoAuthConfig | undefined {
  const openchoreoConfig = config.getOptionalConfig('openchoreo');
  if (!openchoreoConfig) {
    return undefined;
  }

  const authConfig = openchoreoConfig.getOptionalConfig('auth');
  if (!authConfig) {
    return undefined;
  }

  const clientId = authConfig.getOptionalString('clientId');
  const clientSecret = authConfig.getOptionalString('clientSecret');
  const tokenUrl = authConfig.getOptionalString('tokenUrl');

  // All three are required for client credentials
  if (!clientId || !clientSecret || !tokenUrl) {
    return undefined;
  }

  const scopes = authConfig.getOptionalStringArray('scopes');

  return {
    clientId,
    clientSecret,
    tokenUrl,
    scopes,
  };
}
