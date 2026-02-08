/**
 * Backstage-specific factory functions.
 *
 * Isolates the `@backstage/config` dependency so the core client
 * can be consumed by non-Backstage projects.
 *
 * @packageDocumentation
 */

import { Config } from '@backstage/config';
import type { Logger } from './logger';
import { createOpenChoreoApiClient } from './factory';

/**
 * Creates OpenChoreo API clients from Backstage configuration
 *
 * @param config - Backstage Config object
 * @param logger - Optional logger service
 * @returns Object containing the main API client
 *
 * @example
 * ```typescript
 * // In your Backstage backend module
 * const client = createOpenChoreoClientFromConfig(config, logger);
 * const { data: projects } = await client.GET('/namespaces/{namespaceName}/projects', {
 *   params: { path: { namespaceName: 'my-namespace' } }
 * });
 * ```
 *
 * @remarks
 * Expects the following configuration in app-config.yaml:
 * ```yaml
 * openchoreo:
 *   baseUrl: https://openchoreo.example.com
 *   token: ${OPENCHOREO_TOKEN}
 * ```
 */
export function createOpenChoreoClientFromConfig(
  config: Config,
  logger?: Logger,
) {
  const baseUrl = config.getString('openchoreo.baseUrl');
  const token = config.getOptionalString('openchoreo.token');

  logger?.info('Initializing OpenChoreo API client');

  return createOpenChoreoApiClient({
    baseUrl,
    token,
    logger,
  });
}
