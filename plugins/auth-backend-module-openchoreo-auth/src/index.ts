/**
 * OpenChoreo authentication backend module for Backstage.
 *
 * This module provides OAuth/OIDC authentication for OpenChoreo.
 * It works with any OIDC-compliant identity provider configured in OpenChoreo.
 *
 * @packageDocumentation
 */

export { OpenChoreoAuthModule } from './auth';
export { openChoreoAuthenticator } from './oidcAuthenticator';
export * from './jwtUtils';
