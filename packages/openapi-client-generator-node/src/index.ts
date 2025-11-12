/**
 * OpenAPI Client Generator for Backstage Plugins
 *
 * This package provides scripts and utilities to generate type-safe TypeScript API clients
 * from OpenAPI specifications.
 *
 * @packageDocumentation
 */

// Re-export openapi-fetch for convenience
export { default as createClient } from 'openapi-fetch';
export type { ClientOptions, FetchResponse, FetchOptions } from 'openapi-fetch';

/**
 * To use this generator:
 * 1. Create an openapi-config.json file in your package root
 * 2. Add OpenAPI spec files to your package
 * 3. Run: bash node_modules/@openchoreo/openapi-client-generator-node/scripts/generate-client.sh --config openapi-config.json
 *
 * See README.md for detailed usage instructions.
 */
