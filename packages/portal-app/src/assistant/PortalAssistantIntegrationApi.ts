/**
 * The assistant integration seam. The contract itself lives in
 * `@openchoreo/backstage-plugin-react` so the OpenChoreo plugins can consume
 * slots (build-failure notifier, deploy investigate action) without depending
 * on this shell package; re-exported here because the shell documents this as
 * its public integration point for host apps.
 */
export {
  portalAssistantIntegrationApiRef,
  usePortalAssistant,
} from '@openchoreo/backstage-plugin-react';
export type { PortalAssistantIntegration } from '@openchoreo/backstage-plugin-react';
