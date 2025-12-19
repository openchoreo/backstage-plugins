import { LoggerService, AuthService } from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';
import { CatalogApi } from '@backstage/catalog-client';
import { AuthzProfileService } from '../services';

/**
 * Options for the OpenChoreoPermissionPolicy.
 */
export interface OpenChoreoPermissionPolicyOptions {
  /** Service for fetching user capabilities */
  authzService: AuthzProfileService;
  /** Catalog API for fetching entity information */
  catalog: CatalogApi;
  /** Auth service for getting service tokens */
  auth: AuthService;
  /** OpenChoreo configuration */
  config: Config;
  /** Logger service */
  logger: LoggerService;
}
