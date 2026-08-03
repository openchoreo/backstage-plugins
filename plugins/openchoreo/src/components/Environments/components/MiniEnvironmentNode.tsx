import { useState, type MouseEvent as ReactMouseEvent } from 'react';
import {
  Box,
  Button,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@material-ui/core';
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import CloudIcon from '@material-ui/icons/Cloud';
import CodeOutlinedIcon from '@material-ui/icons/CodeOutlined';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import RefreshIcon from '@material-ui/icons/Refresh';
import ReportProblemOutlinedIcon from '@material-ui/icons/ReportProblemOutlined';
import SettingsOutlinedIcon from '@material-ui/icons/SettingsOutlined';
import clsx from 'clsx';
import { StatusBadge } from '@openchoreo/backstage-design-system';
import {
  formatRelativeTime,
  usePromoteToEnvPermission,
  useReleaseBindingUpdatePermission,
  useReleaseBindingViewPermission,
} from '@openchoreo/backstage-plugin-react';
import { useMiniEnvironmentNodeStyles } from '../styles';
import { useEnvironmentStatusVariant } from '../hooks/useEnvironmentStatusVariant';
import {
  usePromotionAction,
  type PromotionTargetAction,
} from '../hooks/usePromotionAction';
import { deriveVersionLabel } from '../utils/deriveVersionLabel';
import type { ActionTrackers, Environment } from '../types';
import { ReleaseManifestDialog } from './ReleaseManifestDialog';

export interface MiniEnvironmentNodeProps {
  environment: Environment;
  selected: boolean;
  isRefreshing: boolean;
  isAlreadyPromoted: (targetEnvName: string) => boolean;
  /** Reports whether a promote target env's project is undeployed (blocks it). */
  isTargetProjectBlocked?: (target: {
    name: string;
    resourceName?: string;
  }) => boolean;
  actionTrackers: ActionTrackers;
  /**
   * Active-incident count from useIncidentsSummary. Undefined when
   * observability isn't configured; rendered as a red chip when > 0.
   */
  activeIncidentCount?: number;
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
  isTargetProjectBlocked,
  actionTrackers,
  activeIncidentCount,
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
  const [manifestOpen, setManifestOpen] = useState(false);

  // Component-level failures (no binding) are surfaced on the Setup card only —
  // a binding-less env tile just reads its normal status (e.g. "Not Deployed").
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
    environmentResourceName: environment.resourceName,
    bindingName: environment.bindingName,
    deploymentStatus: environment.deployment.status,
    statusReason: environment.deployment.statusReason,
    promotionTargets: environment.promotionTargets,
    isAlreadyPromoted,
    isTargetProjectBlocked,
    promotionTracker: actionTrackers.promotionTracker,
    suspendTracker: actionTrackers.suspendTracker,
    onPromote,
    onSuspend: noop,
    onRedeploy: noop,
  });

  // ABAC env-aware permission check for the Configure overrides menu item.
  // Configure overrides edits an *existing* release binding, so the action
  // is releasebinding:update — not :create. Resource name (not display name)
  // is what the cluster's CEL matches against.
  const envResourceName = environment.resourceName ?? environment.name;
  const {
    canUpdate: canConfigureOverrides,
    deniedTooltip: configureOverridesDeniedTooltip,
  } = useReleaseBindingUpdatePermission(envResourceName);
  // Per-env view permission. When denied, the tile is still rendered (so the
  // user sees the env exists) but its body is replaced with a compact "No
  // permissions" placeholder. The detail panel mirrors this state when the
  // env is selected.
  const {
    canViewBinding,
    loading: viewPermissionLoading,
    deniedTooltip: viewDeniedTooltip,
  } = useReleaseBindingViewPermission(envResourceName);

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
      return (
        <PromotePrimaryButton
          action={visibleActions[0]}
          className={classes.primaryButton}
          onStop={stop}
        />
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
      className={clsx(classes.card, { [classes.cardSelected]: selected })}
      onClick={onSelect}
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
            <Box className={classes.nameWrap}>
              <CloudIcon
                className={classes.kindIcon}
                fontSize="small"
                aria-hidden
              />
              <Tooltip
                title={environment.name}
                disableHoverListener={environment.name.length < 20}
                PopperProps={{ disablePortal: true }}
              >
                <button
                  type="button"
                  className={classes.nameButton}
                  aria-pressed={selected}
                  aria-label={`Select environment ${environment.name}`}
                  onClick={e => {
                    // Outer Box also has onClick; stop here so we don't
                    // double-fire onSelect.
                    e.stopPropagation();
                    onSelect();
                  }}
                >
                  {environment.name}
                </button>
              </Tooltip>
            </Box>
            <Tooltip title="More actions" PopperProps={{ disablePortal: true }}>
              <IconButton
                size="small"
                className={classes.menuButton}
                onClick={openMenu}
                aria-label={`Actions for ${environment.name}`}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          {!canViewBinding && !viewPermissionLoading ? (
            <Tooltip
              title={viewDeniedTooltip}
              disableHoverListener={!viewDeniedTooltip}
              PopperProps={{ disablePortal: true }}
            >
              <Box className={classes.metaRow}>
                <Typography
                  variant="caption"
                  color="textSecondary"
                  style={{ fontStyle: 'italic' }}
                >
                  No permissions to view this environment
                </Typography>
              </Box>
            </Tooltip>
          ) : (
            <>
              {/* Row 1 — primary identity: status + version + drift. */}
              <Box className={classes.metaRow}>
                <span className={classes.metaLabel}>status:</span>
                <StatusBadge status={statusVariant.variant} />
                {versionLabel && (
                  <Tooltip
                    title={
                      <>
                        {environment.deployment.releaseName && (
                          <div>
                            Release: {environment.deployment.releaseName}
                          </div>
                        )}
                        {environment.deployment.image && (
                          <div>Image: {environment.deployment.image}</div>
                        )}
                      </>
                    }
                    disableHoverListener={
                      !environment.deployment.image &&
                      !environment.deployment.releaseName
                    }
                    PopperProps={{ disablePortal: true }}
                  >
                    <span className={classes.versionChip}>{versionLabel}</span>
                  </Tooltip>
                )}
              </Box>

              {/* Row 2 — supplementary: incidents + freshness. Skipped
              entirely when nothing here applies so we don't render an
              empty row. */}
              {((!!activeIncidentCount && activeIncidentCount > 0) ||
                relativeTime) && (
                <Box className={classes.metaRow}>
                  {!!activeIncidentCount && activeIncidentCount > 0 && (
                    <Tooltip
                      title={`${activeIncidentCount} active incident${
                        activeIncidentCount === 1 ? '' : 's'
                      }`}
                      PopperProps={{ disablePortal: true }}
                    >
                      <span
                        className={clsx(
                          classes.metaChip,
                          classes.metaChipDanger,
                        )}
                        aria-label="active incidents"
                      >
                        <ReportProblemOutlinedIcon fontSize="inherit" />
                        {activeIncidentCount}
                      </span>
                    </Tooltip>
                  )}
                  {relativeTime && (
                    <>
                      <span className={classes.metaLabel}>deployed:</span>
                      <Typography
                        variant="caption"
                        color="textSecondary"
                        className={classes.timeText}
                      >
                        {relativeTime}
                      </Typography>
                    </>
                  )}
                </Box>
              )}
              <Box className={classes.actionRow}>{renderActions()}</Box>
            </>
          )}
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
        {/* Group 1 — read-only views */}
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
        <Tooltip
          title={
            environment.deployment.releaseName
              ? ''
              : 'No release on this environment yet.'
          }
          placement="left"
        >
          <span>
            <MenuItem
              onClick={e => {
                stop(e);
                closeMenu();
                onOpenReleaseDetails();
              }}
              disabled={!environment.deployment.releaseName}
            >
              <OpenInNewIcon fontSize="small" style={{ marginRight: 8 }} />
              View K8s artifacts
            </MenuItem>
          </span>
        </Tooltip>
        <Tooltip
          title={
            environment.deployment.releaseName
              ? ''
              : 'No release on this environment yet.'
          }
          placement="left"
        >
          <span>
            <MenuItem
              onClick={e => {
                stop(e);
                closeMenu();
                setManifestOpen(true);
              }}
              disabled={!environment.deployment.releaseName}
            >
              <CodeOutlinedIcon fontSize="small" style={{ marginRight: 8 }} />
              View release manifest
            </MenuItem>
          </span>
        </Tooltip>

        <Divider />

        {/* Group 2 — mutating actions */}
        <Tooltip
          title={
            configureOverridesDeniedTooltip ||
            (environment.bindingName
              ? ''
              : 'Deploy this environment first to configure overrides.')
          }
          placement="left"
        >
          <span>
            <MenuItem
              onClick={e => {
                stop(e);
                closeMenu();
                onOpenOverrides();
              }}
              disabled={!environment.bindingName || !canConfigureOverrides}
            >
              <SettingsOutlinedIcon
                fontSize="small"
                style={{ marginRight: 8 }}
              />
              Configure overrides
            </MenuItem>
          </span>
        </Tooltip>
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
          <PromoteMenuItemRow
            key={action.target.name}
            action={action}
            onStop={stop}
            onAfterClick={() => {
              setPromoteAnchor(null);
              setPromoteToSubAnchor(null);
            }}
          />
        ))}
      </Menu>

      <ReleaseManifestDialog
        open={manifestOpen}
        onClose={() => setManifestOpen(false)}
        releaseName={environment.deployment.releaseName}
        environmentName={environment.name}
      />
    </Box>
  );
};

/**
 * Primary Promote button (single eligible target). Calls
 * `usePromoteToEnvPermission(target)` so the disabled state honors both
 * `releasebinding:create` and `releasebinding:update` on the target env's
 * ABAC CEL constraints.
 */
interface PromotePrimaryButtonProps {
  action: PromotionTargetAction;
  className?: string;
  onStop: (e: ReactMouseEvent) => void;
}
function PromotePrimaryButton({
  action,
  className,
  onStop,
}: PromotePrimaryButtonProps) {
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
          className={className}
          disabled={disabled}
          onClick={e => {
            onStop(e);
            action.onClick();
          }}
        >
          {action.isPromoting ? 'Promoting...' : 'Promote'}
        </Button>
      </span>
    </Tooltip>
  );
}

/**
 * Single MenuItem inside the multi-target promote menu. Same ABAC story as
 * `PromotePrimaryButton` — see `usePromoteToEnvPermission`.
 */
interface PromoteMenuItemRowProps {
  action: PromotionTargetAction;
  onStop: (e: ReactMouseEvent) => void;
  onAfterClick: () => void;
}
function PromoteMenuItemRow({
  action,
  onStop,
  onAfterClick,
}: PromoteMenuItemRowProps) {
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
          onClick={e => {
            onStop(e);
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
