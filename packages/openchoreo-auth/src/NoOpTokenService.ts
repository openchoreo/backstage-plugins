import { Request } from 'express';
import { OpenChoreoTokenService } from './OpenChoreoTokenService';

/**
 * No-op implementation of OpenChoreoTokenService.
 * Used when authentication is disabled (openchoreo.features.auth.enabled = false).
 * All token operations return undefined or false.
 */
export class NoOpTokenService implements OpenChoreoTokenService {
  getUserToken(_req: Request): string | undefined {
    return undefined;
  }

  getUserTokenRequired(_req: Request): string {
    throw new Error(
      'Authentication is disabled (openchoreo.features.auth.enabled = false)',
    );
  }

  async getServiceToken(): Promise<string> {
    throw new Error('Authentication is disabled - no service token available');
  }

  hasServiceCredentials(): boolean {
    return false;
  }
}
