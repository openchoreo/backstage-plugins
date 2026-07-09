import { useReleaseBindingUpdatePermission } from '@openchoreo/backstage-plugin-react';
import type { ItemActionTracker } from '../types';

export interface PromotionTargetInfo {
  name: string;
  resourceName?: string;
}

export interface PromotionTargetAction {
  target: PromotionTargetInfo;
  label: string;
  /**
   * True when the action is disabled for non-permission reasons
   * (already promoted, in-flight, target project not deployed). Permission-
   * driven disabling is layered on top by the consumer via
   * `usePromoteToEnvPermission(target)` — hooks cannot be called in a loop
   * here.
   */
  disabled: boolean;
  /**
   * Set when the target env's project is not deployed there — the reason the
   * action is blocked, surfaced as a tooltip by consumers.
   */
  blockedReason?: string;
  isAlreadyPromoted: boolean;
  isPromoting: boolean;
  onClick: () => void;
}

export interface UndeployRedeployAction {
  kind: 'undeploy' | 'redeploy';
  label: string;
  disabled: boolean;
  isInFlight: boolean;
  deniedTooltip: string;
  onClick: () => void;
}

export interface UsePromotionActionInput {
  environmentName: string;
  /**
   * Kubernetes resource name of the environment (e.g. "production"). Falls
   * back to `environmentName` if omitted. Used as the value for the ABAC
   * `resource.environment` attribute, which the cluster's CEL expressions
   * match against the lowercase resource name — not the display name.
   */
  environmentResourceName?: string;
  bindingName?: string;
  deploymentStatus?: 'Ready' | 'NotReady' | 'Failed';
  statusReason?: string;
  promotionTargets?: PromotionTargetInfo[];
  isAlreadyPromoted: (targetEnvName: string) => boolean;
  /**
   * Reports whether a target env has its project undeployed (cell namespace
   * missing), which blocks promotion into it. Optional — omitted by consumers
   * where the project prerequisite does not apply (e.g. resource envs).
   */
  isTargetProjectBlocked?: (target: PromotionTargetInfo) => boolean;
  promotionTracker: ItemActionTracker;
  suspendTracker: ItemActionTracker;
  onPromote: (targetEnvName: string) => void | Promise<void>;
  onSuspend: () => void | Promise<void>;
  onRedeploy: () => void | Promise<void>;
}

export interface UsePromotionActionResult {
  /** Per-target promotion actions, in input order. Empty when status !== Ready or no targets. */
  promotionActions: PromotionTargetAction[];
  /** Single primary promotion action for compact UIs (first non-promoted, non-disabled target). */
  primaryPromotion: PromotionTargetAction | null;
  /** Undeploy / Redeploy action when a binding exists; null otherwise. */
  undeployAction: UndeployRedeployAction | null;
  /** True if all promotion buttons in the list are disabled (used to short-circuit headers/tooltips). */
  allPromotionsDisabled: boolean;
}

/**
 * Centralizes the per-target promotion + undeploy/redeploy decision tree
 * (label / disabled / "already promoted" / in-flight) so the full-card
 * EnvironmentActions row, the mini node primary action, and the detail
 * panel can all derive identical button state.
 */
export function usePromotionAction({
  environmentName,
  environmentResourceName,
  bindingName,
  deploymentStatus,
  statusReason,
  promotionTargets,
  isAlreadyPromoted,
  isTargetProjectBlocked,
  promotionTracker,
  suspendTracker,
  onPromote,
  onSuspend,
  onRedeploy,
}: UsePromotionActionInput): UsePromotionActionResult {
  const permissionEnvName = environmentResourceName ?? environmentName;

  // Undeploy/redeploy acts on the current environment, so its permission
  // honors ABAC `resource.environment` for this env (releasebinding:update).
  const {
    canUpdate: canUpdateThisEnv,
    loading: updatePermissionLoading,
    deniedTooltip: updateDeniedTooltip,
  } = useReleaseBindingUpdatePermission(permissionEnvName);

  const isUndeployed = statusReason === 'ResourcesUndeployed';

  // Per-target promote permission requires both create AND update on the
  // *target* env — see usePromoteToEnvPermission. We cannot call that
  // hook in a loop, so consumers call it per-rendered-button. Here we
  // surface only the non-permission state (label / promoted / in-flight /
  // onClick); the consumer ANDs in its own permission result.
  const promotionActions: PromotionTargetAction[] =
    deploymentStatus === 'Ready' && promotionTargets
      ? promotionTargets.map(target => {
          // Tracker key must match what we pass to onPromote — both
          // target the same in-flight promotion. PipelineCanvas keys
          // its tracker on resourceName ?? name (PipelineCanvas.tsx).
          const targetKey = target.resourceName ?? target.name;
          const promoted = isAlreadyPromoted(target.name);
          const promoting = promotionTracker.isActive(targetKey);
          const projectBlocked = isTargetProjectBlocked?.(target) ?? false;
          let label: string;
          if (promoted) {
            label = `Promoted to ${target.name}`;
          } else if (promoting) {
            label = 'Promoting...';
          } else {
            label = `Promote to ${target.name}`;
          }
          return {
            target,
            label,
            disabled: promoting || promoted || projectBlocked,
            blockedReason: projectBlocked
              ? `Project is not deployed to ${target.name} yet.`
              : undefined,
            isAlreadyPromoted: promoted,
            isPromoting: promoting,
            onClick: () => onPromote(targetKey),
          };
        })
      : [];

  const primaryPromotion =
    promotionActions.find(a => !a.disabled && !a.isAlreadyPromoted) ?? null;

  const allPromotionsDisabled =
    promotionActions.length > 0 && promotionActions.every(a => a.disabled);

  let undeployAction: UndeployRedeployAction | null = null;
  if (bindingName) {
    const inFlight = suspendTracker.isActive(environmentName);
    if (isUndeployed) {
      undeployAction = {
        kind: 'redeploy',
        label: inFlight ? 'Redeploying...' : 'Redeploy',
        disabled: updatePermissionLoading || inFlight || !canUpdateThisEnv,
        isInFlight: inFlight,
        deniedTooltip: updateDeniedTooltip,
        onClick: () => onRedeploy(),
      };
    } else {
      undeployAction = {
        kind: 'undeploy',
        label: inFlight ? 'Undeploying...' : 'Undeploy',
        disabled: updatePermissionLoading || inFlight || !canUpdateThisEnv,
        isInFlight: inFlight,
        deniedTooltip: updateDeniedTooltip,
        onClick: () => onSuspend(),
      };
    }
  }

  return {
    promotionActions,
    primaryPromotion,
    undeployAction,
    allPromotionsDisabled,
  };
}
