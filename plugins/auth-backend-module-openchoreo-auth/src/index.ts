/**
 * OpenChoreo authentication backend module for Backstage.
 *
 * This module provides OAuth/OIDC authentication for OpenChoreo.
 * It works with any OIDC-compliant identity provider configured in OpenChoreo.
 *
 * @packageDocumentation
 */

/**
 * Also the default export, so that backend feature discovery picks this module
 * up. Discovery reads a package's default export only, and this was previously
 * reachable as a named export alone — which is why the install guide adds it
 * with `backend.add(OpenChoreoAuthModule)` while every sibling package uses a
 * dynamic import.
 */
export { OpenChoreoAuthModule, OpenChoreoAuthModule as default } from './auth';
export { openChoreoAuthenticator } from './oidcAuthenticator';
export * from './jwtUtils';
