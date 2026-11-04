/**
 * The OpenChoreo Portal's frontend shell as composable building blocks.
 *
 * This package is the agreed landing place for app-shell pieces as they are
 * migrated to the new frontend system: sign-in, navigation/layout, custom
 * catalog/entity/scaffolder pages, and scaffolder field extensions. Migrated
 * code lives here (not in packages/app) so the custom-portal scaffold can
 * consume it — see the portal composition proposal.
 *
 * The shell installs itself through frontend feature discovery: the `./alpha`
 * entry point default-exports a feature loader carrying the whole portal, so an
 * app package only needs this dependency plus `app.packages` in its config.
 * {@link createPortalApp} is the no-config alternative for hosts that would
 * rather call one function; both read the same loader.
 *
 * Published in lockstep with the rest of `@openchoreo/*`, so one version number
 * identifies a whole portal.
 *
 * @packageDocumentation
 */

export { createPortalApp } from './createPortalApp';
export type { PortalAppOptions } from './createPortalApp';
export {
  brandName,
  useBranding,
  DEFAULT_BRAND_NAME,
} from '@openchoreo/backstage-design-system';
export type { BrandingConfig } from '@openchoreo/backstage-design-system';
