import { useState } from 'react';
import { Button, Menu, MenuItem, Tooltip } from '@material-ui/core';
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import { usePromotionAction } from '../hooks/usePromotionAction';
import type { PromotionTargetInfo } from '../hooks/usePromotionAction';
import type { ItemActionTracker } from '../types';

export interface PromotePrimaryActionProps {
  environmentName: string;
  bindingName?: string;
  deploymentStatus?: 'Ready' | 'NotReady' | 'Failed';
  statusReason?: string;
  promotionTargets?: PromotionTargetInfo[];
  isAlreadyPromoted: (targetEnvName: string) => boolean;
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
  bindingName,
  deploymentStatus,
  statusReason,
  promotionTargets,
  isAlreadyPromoted,
  promotionTracker,
  onPromote,
}: PromotePrimaryActionProps) => {
  const { promotionActions } = usePromotionAction({
    environmentName,
    bindingName,
    deploymentStatus,
    statusReason,
    promotionTargets,
    isAlreadyPromoted,
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
    const only = promotionActions[0];
    return (
      <Tooltip
        title={only.deniedTooltip}
        disableHoverListener={!only.deniedTooltip}
      >
        <span>
          <Button
            size="small"
            variant="contained"
            color="primary"
            disabled={only.disabled}
            onClick={only.onClick}
          >
            {only.isPromoting ? 'Promoting...' : 'Promote'}
          </Button>
        </span>
      </Tooltip>
    );
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
          <MenuItem
            key={action.target.name}
            disabled={action.disabled}
            onClick={() => {
              setPromoteAnchor(null);
              setPromoteToSubAnchor(null);
              action.onClick();
            }}
          >
            {action.isAlreadyPromoted
              ? `${action.target.name} (promoted)`
              : action.target.name}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};
