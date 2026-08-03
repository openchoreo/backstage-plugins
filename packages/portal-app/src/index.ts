/**
 * The OpenChoreo Portal's frontend shell as composable building blocks.
 *
 * This package is the agreed landing place for app-shell pieces as they are
 * migrated to the new frontend system: sign-in, navigation/layout, custom
 * catalog/entity/scaffolder pages, and scaffolder field extensions. Migrated
 * code lives here (not in packages/app) so the custom-portal scaffold can
 * consume it — see the portal composition proposal.
 *
 * The package stays private until the migration cleans up the legacy-bridged
 * pieces; the PR that makes it publishable flips `private` and adds it to the
 * changeset linked group.
 *
 * @packageDocumentation
 */

export { createPortalApp } from './createPortalApp';
export type { PortalAppOptions } from './createPortalApp';
export { brandName, useBranding, DEFAULT_BRAND_NAME } from './branding';
export type { BrandingConfig } from './branding';
