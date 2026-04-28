import {
  useDeployPermission,
  useUndeployPermission,
} from '@openchoreo/backstage-plugin-react';
import type { ItemActionTracker } from '../types';

export interface PromotionTargetInfo {
  name: string;
  resourceName?: string;
  requiresApproval?: boolean;
}

export interface PromotionTargetAction {
  target: PromotionTargetInfo;
  label: string;
  disabled: boolean;
  isAlreadyPromoted: boolean;
  isPromoting: boolean;
  deniedTooltip: string;
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
  bindingName?: string;
  deploymentStatus?: 'Ready' | 'NotReady' | 'Failed';
  statusReason?: string;
  promotionTargets?: PromotionTargetInfo[];
  isAlreadyPromoted: (targetEnvName: string) => boolean;
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
 * (label / disabled / approval-required / "already promoted" / in-flight)
 * so the full-card EnvironmentActions row, the mini node primary action,
 * and the detail panel can all derive identical button state.
 */
export function usePromotionAction({
  environmentName,
  bindingName,
  deploymentStatus,
  statusReason,
  promotionTargets,
  isAlreadyPromoted,
  promotionTracker,
  suspendTracker,
  onPromote,
  onSuspend,
  onRedeploy,
}: UsePromotionActionInput): UsePromotionActionResult {
  const {
    canDeploy: canPromote,
    loading: promotePermissionLoading,
    deniedTooltip: promoteDeniedTooltip,
  } = useDeployPermission();

  const {
    canUndeploy,
    loading: undeployPermissionLoading,
    deniedTooltip: undeployDeniedTooltip,
  } = useUndeployPermission();

  const isUndeployed = statusReason === 'ResourcesUndeployed';

  const promotionActions: PromotionTargetAction[] =
    deploymentStatus === 'Ready' && promotionTargets
      ? promotionTargets.map(target => {
          const promoted = isAlreadyPromoted(target.name);
          const promoting = promotionTracker.isActive(target.name);
          let label: string;
          if (promoted) {
            label = `Promoted to ${target.name}`;
          } else if (promoting) {
            label = 'Promoting...';
          } else {
            label = `Promote to ${target.name}${
              target.requiresApproval ? ' (Approval Required)' : ''
            }`;
          }
          return {
            target,
            label,
            disabled:
              promotePermissionLoading || !canPromote || promoting || promoted,
            isAlreadyPromoted: promoted,
            isPromoting: promoting,
            deniedTooltip: promoteDeniedTooltip,
            onClick: () => onPromote(target.resourceName ?? target.name),
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
        disabled: undeployPermissionLoading || inFlight || !canUndeploy,
        isInFlight: inFlight,
        deniedTooltip: undeployDeniedTooltip,
        onClick: () => onRedeploy(),
      };
    } else {
      undeployAction = {
        kind: 'undeploy',
        label: inFlight ? 'Undeploying...' : 'Undeploy',
        disabled: undeployPermissionLoading || inFlight || !canUndeploy,
        isInFlight: inFlight,
        deniedTooltip: undeployDeniedTooltip,
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
