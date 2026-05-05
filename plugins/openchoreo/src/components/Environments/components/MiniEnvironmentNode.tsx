import { useState, type MouseEvent as ReactMouseEvent } from 'react';
import {
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@material-ui/core';
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import RefreshIcon from '@material-ui/icons/Refresh';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import SettingsOutlinedIcon from '@material-ui/icons/SettingsOutlined';
import clsx from 'clsx';
import { formatRelativeTime } from '@openchoreo/backstage-plugin-react';
import { useMiniEnvironmentNodeStyles } from '../styles';
import { useEnvironmentStatusVariant } from '../hooks/useEnvironmentStatusVariant';
import { usePromotionAction } from '../hooks/usePromotionAction';
import { deriveVersionLabel } from '../utils/deriveVersionLabel';
import type { ActionTrackers, Environment } from '../types';

export interface MiniEnvironmentNodeProps {
  environment: Environment;
  selected: boolean;
  isRefreshing: boolean;
  isAlreadyPromoted: (targetEnvName: string) => boolean;
  actionTrackers: ActionTrackers;
  onSelect: () => void;
  onRefresh: () => void;
  onOpenOverrides: () => void;
  onOpenReleaseDetails: () => void;
  onPromote: (targetEnvName: string) => void | Promise<void>;
}

/**
 * Compact representation of an environment for the deploy minimap canvas.
 * Renders status, version, relative deploy time, primary action and an
 * overflow menu in a single click target. Clicking the body (anywhere
 * outside an interactive child) selects the env into the right-pane
 * detail panel.
 */
export const MiniEnvironmentNode = ({
  environment,
  selected,
  isRefreshing,
  isAlreadyPromoted,
  actionTrackers,
  onSelect,
  onRefresh,
  onOpenOverrides,
  onOpenReleaseDetails,
  onPromote,
}: MiniEnvironmentNodeProps) => {
  const classes = useMiniEnvironmentNodeStyles();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [promoteAnchor, setPromoteAnchor] = useState<HTMLElement | null>(null);
  const [promoteToSubAnchor, setPromoteToSubAnchor] =
    useState<HTMLElement | null>(null);

  const statusVariant = useEnvironmentStatusVariant(
    environment.deployment.status,
    environment.deployment.statusReason,
  );

  // Lifecycle (suspend/redeploy) is owned by the RHS detail panel — the
  // tile only surfaces promotion. Pass no-op stubs for the suspend/redeploy
  // callbacks so the shared hook can return its full result, but only
  // consume `promotionActions`.
  const noop = () => {};
  const { promotionActions } = usePromotionAction({
    environmentName: environment.name,
    bindingName: environment.bindingName,
    deploymentStatus: environment.deployment.status,
    statusReason: environment.deployment.statusReason,
    promotionTargets: environment.promotionTargets,
    isAlreadyPromoted,
    promotionTracker: actionTrackers.promotionTracker,
    suspendTracker: actionTrackers.suspendTracker,
    onPromote,
    onSuspend: noop,
    onRedeploy: noop,
  });

  // Only surface promote on the canvas tile when the env is actually
  // deployed (has a binding). `usePromotionAction` already gates on
  // `status === 'Ready'` and the presence of targets; the binding gate
  // is the LHS-specific rule (RHS may want to surface state differently).
  const promoteVisible = !!environment.bindingName;
  const eligibleTargets = promoteVisible
    ? promotionActions.filter(a => !a.isAlreadyPromoted)
    : [];
  const visibleActions = promoteVisible ? promotionActions : [];
  const allPromoted = visibleActions.length > 0 && eligibleTargets.length === 0;
  const isAnyPromoting = visibleActions.some(a => a.isPromoting);

  const versionLabel = deriveVersionLabel(environment.deployment.image);
  const relativeTime = environment.deployment.lastDeployed
    ? formatRelativeTime(environment.deployment.lastDeployed)
    : null;

  const dotClass = clsx(classes.statusDot, {
    [classes.statusDotActive]: statusVariant.variant === 'active',
    [classes.statusDotPending]: statusVariant.variant === 'pending',
    [classes.statusDotFailed]: statusVariant.variant === 'failed',
    [classes.statusDotIdle]:
      statusVariant.variant !== 'active' &&
      statusVariant.variant !== 'pending' &&
      statusVariant.variant !== 'failed',
  });

  const stop = (e: ReactMouseEvent) => e.stopPropagation();

  const openMenu = (e: ReactMouseEvent<HTMLElement>) => {
    e.stopPropagation();
    // Selecting on menu-open keeps "the thing I'm working on" highlighted
    // — picking any menu item that navigates to an intermediate page (e.g.
    // Configure overrides) will then leave a tile selected to come back to.
    onSelect();
    setMenuAnchor(e.currentTarget);
  };
  const closeMenu = () => setMenuAnchor(null);

  const renderActions = () => {
    if (visibleActions.length === 0) {
      return null;
    }
    if (allPromoted) {
      return (
        <Button
          size="small"
          variant="contained"
          disabled
          className={classes.primaryButton}
        >
          Promoted
        </Button>
      );
    }
    if (visibleActions.length === 1) {
      const only = visibleActions[0];
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
              className={classes.primaryButton}
              disabled={only.disabled}
              onClick={e => {
                stop(e);
                only.onClick();
              }}
            >
              {only.isPromoting ? 'Promoting...' : 'Promote'}
            </Button>
          </span>
        </Tooltip>
      );
    }
    // Multi-target — render the trigger; the menus themselves live in the
    // JSX tree below alongside the existing overflow menu.
    return (
      <Button
        size="small"
        variant="contained"
        color="primary"
        className={classes.primaryButton}
        endIcon={<ArrowDropDownIcon fontSize="small" />}
        disabled={eligibleTargets.every(a => a.disabled)}
        aria-haspopup="true"
        onClick={e => {
          stop(e);
          setPromoteAnchor(e.currentTarget);
        }}
      >
        {isAnyPromoting ? 'Promoting...' : 'Promote'}
      </Button>
    );
  };

  return (
    <Box
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Select environment ${environment.name}`}
      className={clsx(classes.card, { [classes.cardSelected]: selected })}
      onClick={onSelect}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <Box display="flex" height="100%" minWidth={0}>
        <Box
          className={clsx(classes.statusStripe, {
            [classes.statusDotActive]: statusVariant.variant === 'active',
            [classes.statusDotPending]: statusVariant.variant === 'pending',
            [classes.statusDotFailed]: statusVariant.variant === 'failed',
            [classes.statusDotIdle]:
              statusVariant.variant !== 'active' &&
              statusVariant.variant !== 'pending' &&
              statusVariant.variant !== 'failed',
          })}
          aria-hidden
        />
        <Box className={classes.body}>
          <Box className={classes.topRow}>
            <Tooltip
              title={environment.name}
              disableHoverListener={environment.name.length < 20}
              PopperProps={{ disablePortal: true }}
            >
              <Typography className={classes.name}>
                {environment.name}
              </Typography>
            </Tooltip>
            <IconButton
              size="small"
              className={classes.menuButton}
              onClick={openMenu}
              aria-label={`Actions for ${environment.name}`}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </Box>
          <Box className={classes.metaRow}>
            <span className={dotClass} aria-hidden />
            {versionLabel ? (
              <Tooltip
                title={environment.deployment.image ?? ''}
                disableHoverListener={!environment.deployment.image}
                PopperProps={{ disablePortal: true }}
              >
                <span className={classes.versionChip}>{versionLabel}</span>
              </Tooltip>
            ) : (
              <span className={classes.versionChip}>—</span>
            )}
            {relativeTime && (
              <Typography
                variant="caption"
                color="textSecondary"
                className={classes.timeText}
              >
                {relativeTime}
              </Typography>
            )}
          </Box>
          <Box className={classes.actionRow}>{renderActions()}</Box>
        </Box>
      </Box>

      <Menu
        anchorEl={menuAnchor}
        open={!!menuAnchor}
        onClose={closeMenu}
        onClick={stop}
        keepMounted
        getContentAnchorEl={null}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem
          onClick={e => {
            stop(e);
            closeMenu();
            onRefresh();
          }}
          disabled={isRefreshing}
        >
          <RefreshIcon fontSize="small" style={{ marginRight: 8 }} />
          Refresh
        </MenuItem>
        {environment.deployment.releaseName && (
          <MenuItem
            onClick={e => {
              stop(e);
              closeMenu();
              onOpenReleaseDetails();
            }}
          >
            <OpenInNewIcon fontSize="small" style={{ marginRight: 8 }} />
            View K8s artifacts
          </MenuItem>
        )}
        <MenuItem
          onClick={e => {
            stop(e);
            closeMenu();
            onOpenOverrides();
          }}
        >
          <SettingsOutlinedIcon fontSize="small" style={{ marginRight: 8 }} />
          Configure overrides
        </MenuItem>
      </Menu>

      {/* Top-level Promote menu (multi-target). Anchored to the
          Promote ▾ button on the action row. */}
      <Menu
        anchorEl={promoteAnchor}
        open={!!promoteAnchor}
        onClose={() => {
          setPromoteAnchor(null);
          setPromoteToSubAnchor(null);
        }}
        onClick={stop}
        keepMounted
        getContentAnchorEl={null}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        <MenuItem
          onClick={e => {
            stop(e);
            setPromoteToSubAnchor(e.currentTarget);
          }}
        >
          Promote to…
          <ChevronRightIcon fontSize="small" style={{ marginLeft: 'auto' }} />
        </MenuItem>
        {/* Bulk promote isn't wired yet — surface the affordance disabled
            with a tooltip so users know it's coming. */}
        <Tooltip title="Bulk promote is coming soon — pick targets one at a time for now.">
          <span>
            <MenuItem disabled>Promote to all</MenuItem>
          </span>
        </Tooltip>
      </Menu>

      {/* Nested per-target submenu, anchored to the "Promote to…" item. */}
      <Menu
        anchorEl={promoteToSubAnchor}
        open={!!promoteToSubAnchor}
        onClose={() => setPromoteToSubAnchor(null)}
        onClick={stop}
        keepMounted
        getContentAnchorEl={null}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        {visibleActions.map(action => (
          <MenuItem
            key={action.target.name}
            disabled={action.disabled}
            onClick={e => {
              stop(e);
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
    </Box>
  );
};
