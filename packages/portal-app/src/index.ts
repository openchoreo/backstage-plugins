/**
 * The OpenChoreo Portal's frontend shell as composable building blocks:
 * app assembly (`createPortalApp`), sign-in, navigation/layout, custom
 * catalog/entity/scaffolder pages, and scaffolder field extensions. The stock
 * portal and every portal scaffolded by `@openchoreo/create-portal` render
 * this shell; host apps extend it through `createPortalApp({ features })`.
 *
 * @packageDocumentation
 */

export { createPortalApp } from './createPortalApp';
export type { PortalAppOptions } from './createPortalApp';
export { brandName, useBranding, DEFAULT_BRAND_NAME } from './branding';
export type { BrandingConfig } from './branding';
export {
  portalAssistantIntegrationApiRef,
  usePortalAssistant,
} from './assistant/PortalAssistantIntegrationApi';
export type { PortalAssistantIntegration } from './assistant/PortalAssistantIntegrationApi';
