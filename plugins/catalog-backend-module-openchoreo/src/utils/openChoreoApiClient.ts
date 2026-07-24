import { LoggerService } from '@backstage/backend-plugin-api';
import { createOpenChoreoApiClient } from '@openchoreo/openchoreo-client-node';
import { OpenChoreoTokenService } from '@openchoreo/openchoreo-auth';

export type OpenChoreoApiClient = ReturnType<typeof createOpenChoreoApiClient>;

/**
 * Builds an authenticated OpenChoreo API client. Acquires a service token
 * via the optional `OpenChoreoTokenService`.
 *
 * When credentials are configured but the token cannot be obtained (e.g. the
 * IdP is briefly unreachable at cold start), this throws rather than returning
 * an unauthenticated client — every API call would 401 anyway, so failing
 * fast lets the caller's retry path re-attempt soon. When no credentials are
 * configured (auth disabled), an unauthenticated client is returned as before.
 */
export async function createAuthenticatedOpenChoreoApiClient(opts: {
  baseUrl: string;
  logger: LoggerService;
  tokenService?: OpenChoreoTokenService;
}): Promise<OpenChoreoApiClient> {
  const { baseUrl, logger, tokenService } = opts;
  let token: string | undefined;
  if (tokenService?.hasServiceCredentials()) {
    try {
      token = await tokenService.getServiceToken();
    } catch (error) {
      logger.error(`Failed to get OpenChoreo service token: ${error}`);
      throw error;
    }
  }
  return createOpenChoreoApiClient({ baseUrl, token, logger });
}
