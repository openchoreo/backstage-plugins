import { LoggerService } from '@backstage/backend-plugin-api';
import { createOpenChoreoApiClient } from '@openchoreo/openchoreo-client-node';
import { OpenChoreoTokenService } from '@openchoreo/openchoreo-auth';

export type OpenChoreoApiClient = ReturnType<typeof createOpenChoreoApiClient>;

/**
 * Builds an authenticated OpenChoreo API client. Acquires a service token
 * via the optional `OpenChoreoTokenService`; if token acquisition fails,
 * logs a warning and returns an unauthenticated client.
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
      logger.warn(
        `Failed to get service token, continuing without auth: ${error}`,
      );
    }
  }
  return createOpenChoreoApiClient({ baseUrl, token, logger });
}
