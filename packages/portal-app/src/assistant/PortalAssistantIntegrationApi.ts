import { createApiRef, useApiHolder } from '@backstage/core-plugin-api';
import type { ComponentType, ReactNode } from 'react';
import type { RenderInvestigateAction } from '@openchoreo/backstage-plugin';

/**
 * Optional integration slots an AI-assistant feature can fill in the portal
 * shell. The shell owns only this contract — it has no dependency on any
 * assistant implementation. When no implementation is registered every slot
 * is absent and the shell renders exactly nothing in its place.
 *
 * Register an implementation from a host app via an `ApiBlueprint` extension
 * for {@link portalAssistantIntegrationApiRef} passed through
 * `createPortalApp({ features })`.
 */
export interface PortalAssistantIntegration {
  /**
   * Wraps the routed app content inside the shell's Root layout (below the
   * query/scaffolder context providers) — the slot for a global assistant
   * drawer/chrome provider. The shell always passes children, so
   * implementations may declare them required.
   */
  AppWrapper?: ComponentType<{ children: ReactNode }>;

  /**
   * Mounted on component entity Overview and Build tabs. Expected to render
   * nothing unless it has something to prompt about (e.g. the latest build
   * run failed).
   */
  BuildFailureNotifier?: ComponentType<{}>;

  /**
   * Injected into the deploy panel's `renderInvestigateAction` slot — a
   * status-aware "investigate" action for a failing deployment.
   */
  renderInvestigateAction?: RenderInvestigateAction;
}

/**
 * Point of registration for an assistant integration. Deliberately optional:
 * `usePortalAssistant` yields `{}` when nothing is registered.
 */
export const portalAssistantIntegrationApiRef =
  createApiRef<PortalAssistantIntegration>({
    id: 'plugin.openchoreo-portal.assistant-integration',
  });

/**
 * Reads the registered assistant integration, or `{}` when none is installed
 * — callers destructure slots and no-op on `undefined`.
 */
export function usePortalAssistant(): PortalAssistantIntegration {
  return useApiHolder().get(portalAssistantIntegrationApiRef) ?? {};
}
