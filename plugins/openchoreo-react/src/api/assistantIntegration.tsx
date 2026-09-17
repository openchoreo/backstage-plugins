import { createApiRef, useApiHolder } from '@backstage/core-plugin-api';
import type { ComponentType, ReactNode } from 'react';

/**
 * Scope handed to the host-app-supplied "investigate" slot when a
 * deployment is in a problem state. The deploy panel owns the shape and
 * decides *where* the affordance renders, while the host app injects the
 * actual assistant button — so no OpenChoreo plugin keeps a dependency on
 * an assistant implementation.
 */
export interface InvestigateScope {
  /** Control-plane namespace of the component. */
  namespace?: string;
  /** Project the component belongs to. */
  project?: string;
  /** The component whose deployment is in trouble. */
  component: string;
  /** Environment resource name the binding is in. */
  environment?: string;
  /**
   * Which assistant flow to launch: ``dependency_pending`` when the cause
   * is an unresolved connection, otherwise ``runtime_debug``.
   */
  caseType: 'dependency_pending' | 'runtime_debug';
  /** Human-readable deployment status, e.g. ``Pending`` / ``Failed``. */
  status: string;
}

/** Render-prop slot for the deploy-panel investigate affordance. */
export type RenderInvestigateAction = (scope: InvestigateScope) => ReactNode;

/**
 * Optional integration slots an AI-assistant feature can fill across the
 * portal shell and the OpenChoreo plugins. This package owns only the
 * contract — it has no dependency on any assistant implementation. When no
 * implementation is registered every slot is absent and consumers render
 * exactly nothing in its place.
 *
 * Register an implementation from a host app via an `ApiBlueprint` extension
 * for {@link portalAssistantIntegrationApiRef}.
 */
export interface PortalAssistantIntegration {
  /**
   * Wraps the routed app content at the app root — the slot for a global
   * assistant drawer/chrome provider. Consumers always pass children, so
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

/**
 * Mounts the integration's {@link PortalAssistantIntegration.BuildFailureNotifier}
 * slot, or nothing when no assistant is registered — plugins drop this in
 * without any conditional logic of their own.
 */
export const BuildFailureNotifierSlot = () => {
  const { BuildFailureNotifier } = usePortalAssistant();
  return BuildFailureNotifier ? <BuildFailureNotifier /> : null;
};
