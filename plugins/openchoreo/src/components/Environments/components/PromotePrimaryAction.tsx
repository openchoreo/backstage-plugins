import { useState } from 'react';
import { Button, Menu, MenuItem, Tooltip } from '@material-ui/core';
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import { usePromoteToEnvPermission } from '@openchoreo/backstage-plugin-react';
import {
  usePromotionAction,
  type PromotionTargetAction,
  type PromotionTargetInfo,
} from '../hooks/usePromotionAction';
import type { ItemActionTracker } from '../types';

export interface PromotePrimaryActionProps {
  environmentName: string;
  /**
   * Kubernetes resource name of the environment. Forwarded to
   * `usePromotionAction` so the ABAC permission check uses the value that
   * matches the cluster's CEL expressions.
   */
  environmentResourceName?: string;
  bindingName?: string;
  deploymentStatus?: 'Ready' | 'NotReady' | 'Failed';
  statusReason?: string;
  promotionTargets?: PromotionTargetInfo[];
  isAlreadyPromoted: (targetEnvName: string) => boolean;
  /** Reports whether a target env's project is undeployed (blocks promote). */
  isTargetProjectBlocked?: (target: PromotionTargetInfo) => boolean;
  promotionTracker: ItemActionTracker;
  onPromote: (targetEnvName: string) => Promise<void>;
}

const noopTracker: ItemActionTracker = {
  isActive: () => false,
  withTracking: async (_id: string, fn: () => Promise<unknown>) => fn(),
} as unknown as ItemActionTracker;

const noop = () => {};

/**
 * Footer-anchored Promote primary action for the right-pane env detail
 * panel. Mirrors the LHS mini-node behaviour:
 *
 *   - none / not-deployed / not-Ready / no targets → renders nothing
 *   - single non-promoted target → simple "Promote" button
 *   - multi-target → "Promote ▾" trigger with a menu opening upward,
 *     containing "Promote to…" (per-target submenu) and a disabled
 *     "Promote to all" placeholder
 *   - all targets already promoted → disabled "Promoted" pill
 *
 * The hook only needs the promotion half of its result here, so we
 * pass no-op tracker + suspend/redeploy callbacks.
 */
export const PromotePrimaryAction = ({
  environmentName,
  environmentResourceName,
  bindingName,
  deploymentStatus,
  statusReason,
  promotionTargets,
  isAlreadyPromoted,
  isTargetProjectBlocked,
  promotionTracker,
  onPromote,
}: PromotePrimaryActionProps) => {
  const { promotionActions } = usePromotionAction({
    environmentName,
    environmentResourceName,
    bindingName,
    deploymentStatus,
    statusReason,
    promotionTargets,
    isAlreadyPromoted,
    isTargetProjectBlocked,
    promotionTracker,
    suspendTracker: noopTracker,
    onPromote,
    onSuspend: noop,
    onRedeploy: noop,
  });

  const [promoteAnchor, setPromoteAnchor] = useState<HTMLElement | null>(null);
  const [promoteToSubAnchor, setPromoteToSubAnchor] =
    useState<HTMLElement | null>(null);

  // Gate on a binding too — env without a binding (never deployed) has
  // nothing to promote from. Mirrors the LHS rule.
  if (!bindingName || promotionActions.length === 0) {
    return null;
  }

  const eligible = promotionActions.filter(a => !a.isAlreadyPromoted);
  const allPromoted = eligible.length === 0;
  const isAnyPromoting = promotionActions.some(a => a.isPromoting);

  if (allPromoted) {
    return (
      <Button size="small" variant="contained" disabled>
        Promoted
      </Button>
    );
  }

  if (promotionActions.length === 1) {
    return <PromotePrimaryButton action={promotionActions[0]} />;
  }

  return (
    <>
      <Button
        size="small"
        variant="contained"
        color="primary"
        endIcon={<ArrowDropDownIcon fontSize="small" />}
        disabled={eligible.every(a => a.disabled)}
        aria-haspopup="true"
        onClick={e => setPromoteAnchor(e.currentTarget)}
      >
        {isAnyPromoting ? 'Promoting...' : 'Promote'}
      </Button>

      {/* Footer sits at panel bottom — open the top-level menu upward
          so it doesn't fall off the panel. */}
      <Menu
        anchorEl={promoteAnchor}
        open={!!promoteAnchor}
        onClose={() => {
          setPromoteAnchor(null);
          setPromoteToSubAnchor(null);
        }}
        keepMounted
        getContentAnchorEl={null}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <MenuItem onClick={e => setPromoteToSubAnchor(e.currentTarget)}>
          Promote to…
          <ChevronRightIcon fontSize="small" style={{ marginLeft: 'auto' }} />
        </MenuItem>
        <Tooltip title="Bulk promote is coming soon — pick targets one at a time for now.">
          <span>
            <MenuItem disabled>Promote to all</MenuItem>
          </span>
        </Tooltip>
      </Menu>

      <Menu
        anchorEl={promoteToSubAnchor}
        open={!!promoteToSubAnchor}
        onClose={() => setPromoteToSubAnchor(null)}
        keepMounted
        getContentAnchorEl={null}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        {promotionActions.map(action => (
          <PromoteSubMenuItem
            key={action.target.name}
            action={action}
            onAfterClick={() => {
              setPromoteAnchor(null);
              setPromoteToSubAnchor(null);
            }}
          />
        ))}
      </Menu>
    </>
  );
};

/**
 * Single-target Promote button. Calls `usePromoteToEnvPermission(target)`
 * so disabled state honors both `releasebinding:create` and
 * `releasebinding:update` ABAC on the target env.
 */
function PromotePrimaryButton({ action }: { action: PromotionTargetAction }) {
  const targetEnvName = action.target.resourceName ?? action.target.name;
  const { canPromote, loading, deniedTooltip } =
    usePromoteToEnvPermission(targetEnvName);
  const disabled = action.disabled || loading || !canPromote;
  const tooltip =
    action.blockedReason || (!canPromote && !loading ? deniedTooltip : '');
  return (
    <Tooltip title={tooltip} disableHoverListener={!tooltip}>
      <span>
        <Button
          size="small"
          variant="contained"
          color="primary"
          disabled={disabled}
          onClick={action.onClick}
        >
          {action.isPromoting ? 'Promoting...' : 'Promote'}
        </Button>
      </span>
    </Tooltip>
  );
}

/**
 * Sub-menu item for the multi-target promote dropdown. Same ABAC story as
 * `PromotePrimaryButton`.
 */
function PromoteSubMenuItem({
  action,
  onAfterClick,
}: {
  action: PromotionTargetAction;
  onAfterClick: () => void;
}) {
  const targetEnvName = action.target.resourceName ?? action.target.name;
  const { canPromote, loading, deniedTooltip } =
    usePromoteToEnvPermission(targetEnvName);
  const disabled = action.disabled || loading || !canPromote;
  const tooltip =
    action.blockedReason || (!canPromote && !loading ? deniedTooltip : '');
  return (
    <Tooltip title={tooltip} disableHoverListener={!tooltip} placement="left">
      <span>
        <MenuItem
          disabled={disabled}
          onClick={() => {
            onAfterClick();
            action.onClick();
          }}
        >
          {action.isAlreadyPromoted
            ? `${action.target.name} (promoted)`
            : action.target.name}
        </MenuItem>
      </span>
    </Tooltip>
  );
}
