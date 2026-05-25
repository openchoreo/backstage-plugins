import {
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
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
import CloudIcon from '@material-ui/icons/Cloud';
import CodeOutlinedIcon from '@material-ui/icons/CodeOutlined';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import RefreshIcon from '@material-ui/icons/Refresh';
import ReportProblemOutlinedIcon from '@material-ui/icons/ReportProblemOutlined';
import SettingsOutlinedIcon from '@material-ui/icons/SettingsOutlined';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import { StatusBadge } from '@openchoreo/backstage-design-system';
import {
  formatRelativeTime,
  useResourcePromoteToEnvPermission,
  useResourceReleaseBindingUpdatePermission,
} from '@openchoreo/backstage-plugin-react';
import type { ResourceEnvironment } from '../../api/OpenChoreoClientApi';
import { useResourceMiniEnvironmentNodeStyles } from './styles';
import { useResourceEnvironmentsContext } from './ResourceEnvironmentsContext';
import { deriveResourceEnvBadgeStatus } from './badgeStatus';

interface ResourceMiniEnvironmentNodeProps {
  env: ResourceEnvironment;
  selected: boolean;
  onSelect: () => void;
}

export const ResourceMiniEnvironmentNode = ({
  env,
  selected,
  onSelect,
}: ResourceMiniEnvironmentNodeProps) => {
  const classes = useResourceMiniEnvironmentNodeStyles();
  const navigate = useNavigate();
  const {
    environments,
    pendingAction,
    refetch,
    onPromote,
    onViewReleaseManifest,
    driftByEnv,
  } = useResourceEnvironmentsContext();
  const drift = driftByEnv.get(env.name);
  const isBehindUpstream = drift?.isBehind ?? false;
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [promoteAnchor, setPromoteAnchor] = useState<HTMLElement | null>(null);

  const hasBinding = Boolean(env.bindingName);
  const hasRelease = Boolean(env.resourceRelease);
  // ABAC env-aware perm for Configure overrides on THIS env. Use the
  // K8s resource name (not the display name) so `resource.environment`
  // CEL on the cluster matches the expected lowercase RFC 1123 form.
  const envResourceName = env.resourceName ?? env.name;
  const updatePerm = useResourceReleaseBindingUpdatePermission(envResourceName);
  const badgeStatus = deriveResourceEnvBadgeStatus(env);
  const relativeDeployed = env.lastDeployed
    ? formatRelativeTime(env.lastDeployed)
    : null;

  // Card Promote copies this env's release pin forward to the next env's
  // binding (mirrors Component). The pipeline-defined `promotionTargets`
  // enforces ordering: prod has no targets, so the button never appears on
  // the terminal env. There is no skip-the-pipeline "jump to latest"
  // operation by design.
  const promotionTargets = env.promotionTargets ?? [];
  const hasPromotionTargets = promotionTargets.length > 0;
  const eligibleTargets = hasRelease
    ? promotionTargets.filter(t => {
        const targetEnv = environments.find(e => e.name === t.name);
        return targetEnv?.resourceRelease !== env.resourceRelease;
      })
    : [];
  const isReady = env.status === 'Ready';
  const isPromoting = promotionTargets.some(
    t =>
      pendingAction?.kind === 'promote' &&
      pendingAction.env === (t.resourceName ?? t.name),
  );
  const showPromote =
    hasBinding && hasRelease && isReady && hasPromotionTargets;
  const allTargetsInSync = hasPromotionTargets && eligibleTargets.length === 0;

  // Promote needs the K8s-safe resource name (lowercase, RFC 1123).
  // target.name carries the display name (e.g. "Production") which the
  // BFF would otherwise stitch into a `metadata.name` like
  // "orders-db-Production" and get 422'd by the apiserver.
  const handlePromoteSingle = (e: ReactMouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const target = eligibleTargets[0];
    if (!target || !env.resourceRelease) return;
    void onPromote(target.resourceName ?? target.name, env.resourceRelease);
  };

  const openPromoteMenu = (e: ReactMouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setPromoteAnchor(e.currentTarget);
  };
  const closePromoteMenu = () => setPromoteAnchor(null);

  const handlePromoteTo = (target: { name: string; resourceName?: string }) => {
    closePromoteMenu();
    if (!env.resourceRelease) return;
    void onPromote(target.resourceName ?? target.name, env.resourceRelease);
  };

  const isTargetAlreadyPromoted = (targetName: string) => {
    const targetEnv = environments.find(e => e.name === targetName);
    return targetEnv?.resourceRelease === env.resourceRelease;
  };

  const isTargetInFlight = (targetName: string) =>
    pendingAction?.kind === 'promote' && pendingAction.env === targetName;

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect();
    }
  };

  const stopAndOpenMenu = (e: ReactMouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
  };

  const closeMenu = () => setMenuAnchor(null);

  const handleRefresh = () => {
    closeMenu();
    void refetch();
  };

  const handleConfigureOverrides = () => {
    closeMenu();
    navigate(`overrides/${env.resourceName ?? env.name}`);
  };

  const handleViewReleaseManifest = () => {
    closeMenu();
    onViewReleaseManifest(env);
  };

  const renderPromoteButton = () => {
    if (allTargetsInSync) {
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
    if (promotionTargets.length === 1) {
      return (
        <PromotePrimaryButton
          envName={env.name}
          target={eligibleTargets[0]}
          isPromoting={isPromoting}
          className={classes.primaryButton}
          onClick={handlePromoteSingle}
        />
      );
    }
    return (
      <Button
        size="small"
        variant="contained"
        color="primary"
        className={classes.primaryButton}
        endIcon={<ArrowDropDownIcon fontSize="small" />}
        onClick={openPromoteMenu}
        disabled={isPromoting}
        aria-haspopup="true"
        aria-label={`Promote ${env.name}`}
      >
        {isPromoting ? 'Promoting...' : 'Promote'}
      </Button>
    );
  };

  return (
    <Box
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Select environment ${env.name}`}
      className={clsx(classes.card, selected && classes.cardSelected)}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
    >
      <Box display="flex" height="100%" minWidth={0}>
        <Box
          aria-hidden
          className={clsx(classes.statusStripe, {
            [classes.statusStripeActive]: badgeStatus === 'active',
            [classes.statusStripePending]: badgeStatus === 'pending',
            [classes.statusStripeFailed]: badgeStatus === 'failed',
            [classes.statusStripeIdle]:
              badgeStatus !== 'active' &&
              badgeStatus !== 'pending' &&
              badgeStatus !== 'failed',
          })}
        />
        <Box className={classes.body}>
          <Box className={classes.topRow}>
            <Box className={classes.nameWrap}>
              <CloudIcon
                aria-hidden
                className={classes.kindIcon}
                fontSize="small"
              />
              <Tooltip
                title={env.name}
                disableHoverListener={env.name.length < 20}
                PopperProps={{ disablePortal: true }}
              >
                <Typography className={classes.envName}>{env.name}</Typography>
              </Tooltip>
            </Box>
            <Tooltip title="More actions" PopperProps={{ disablePortal: true }}>
              <IconButton
                size="small"
                className={classes.menuButton}
                onClick={stopAndOpenMenu}
                aria-label={`Actions for ${env.name}`}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          <Box className={classes.metaRow}>
            <span className={classes.meta}>STATUS:</span>
            <StatusBadge status={badgeStatus} />
            {isBehindUpstream && (
              <Tooltip
                title={
                  <>
                    <div>
                      Behind{' '}
                      {drift!.aheadUpstreams.map(u => u.envName).join(', ')}
                    </div>
                    {drift!.aheadUpstreams[0]?.releaseName && (
                      <div>
                        {drift!.aheadUpstreams[0].envName} on{' '}
                        {drift!.aheadUpstreams[0].releaseName}
                      </div>
                    )}
                  </>
                }
                PopperProps={{ disablePortal: true }}
              >
                <span
                  className={classes.driftBadge}
                  aria-label="behind upstream"
                >
                  <ReportProblemOutlinedIcon fontSize="inherit" />
                  behind
                </span>
              </Tooltip>
            )}
          </Box>

          {relativeDeployed && (
            <Box className={classes.metaRow}>
              <span className={classes.meta}>DEPLOYED:</span>
              <Typography className={classes.timeText} variant="caption">
                {relativeDeployed}
              </Typography>
            </Box>
          )}

          {showPromote && (
            <Box className={classes.actionRow}>{renderPromoteButton()}</Box>
          )}
        </Box>
      </Box>

      <Menu
        anchorEl={menuAnchor}
        keepMounted
        open={Boolean(menuAnchor)}
        onClose={closeMenu}
        getContentAnchorEl={null}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        onClick={e => e.stopPropagation()}
      >
        <MenuItem onClick={handleRefresh}>
          <RefreshIcon fontSize="small" style={{ marginRight: 8 }} />
          Refresh
        </MenuItem>
        <Tooltip
          title={hasRelease ? '' : 'No release on this environment yet.'}
          placement="left"
          PopperProps={{ disablePortal: true }}
        >
          <span>
            <MenuItem
              onClick={handleViewReleaseManifest}
              disabled={!hasRelease}
            >
              <CodeOutlinedIcon fontSize="small" style={{ marginRight: 8 }} />
              View release manifest
            </MenuItem>
          </span>
        </Tooltip>
        <Divider />
        <Tooltip
          title={
            hasBinding && !updatePerm.loading && !updatePerm.canUpdate
              ? updatePerm.deniedTooltip
              : ''
          }
          placement="left"
          PopperProps={{ disablePortal: true }}
        >
          <span>
            <MenuItem
              onClick={handleConfigureOverrides}
              disabled={
                !hasBinding || updatePerm.loading || !updatePerm.canUpdate
              }
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

      {/* Per-target promote menu, only mounted when the env has more than
          one promotion target (parallel branches). Single-target case uses
          the direct button above. */}
      <Menu
        anchorEl={promoteAnchor}
        keepMounted
        open={Boolean(promoteAnchor)}
        onClose={closePromoteMenu}
        getContentAnchorEl={null}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        onClick={e => e.stopPropagation()}
      >
        {promotionTargets.map(target => (
          <PromoteMenuItemRow
            key={target.name}
            target={target}
            promoted={isTargetAlreadyPromoted(target.name)}
            inFlight={isTargetInFlight(target.resourceName ?? target.name)}
            onClick={() => handlePromoteTo(target)}
          />
        ))}
      </Menu>
    </Box>
  );
};

interface PromoteTarget {
  name: string;
  resourceName?: string;
}

interface PromotePrimaryButtonProps {
  envName: string;
  target: PromoteTarget;
  isPromoting: boolean;
  className?: string;
  onClick: (e: ReactMouseEvent<HTMLButtonElement>) => void;
}

/**
 * Single-target Promote button on the env card. Calls
 * `useResourcePromoteToEnvPermission(target)` so disabled state honors both
 * `resourcereleasebinding:create` and `resourcereleasebinding:update` ABAC
 * on the target env. Mirrors the Component-side `PromotePrimaryButton` in
 * `MiniEnvironmentNode.tsx`.
 */
function PromotePrimaryButton({
  envName,
  target,
  isPromoting,
  className,
  onClick,
}: PromotePrimaryButtonProps) {
  const targetEnvName = target.resourceName ?? target.name;
  const { canPromote, loading, deniedTooltip } =
    useResourcePromoteToEnvPermission(targetEnvName);
  const disabled = isPromoting || loading || !canPromote;
  const tooltip = !canPromote && !loading ? deniedTooltip : '';
  return (
    <Tooltip
      title={tooltip}
      disableHoverListener={!tooltip}
      PopperProps={{ disablePortal: true }}
    >
      <span>
        <Button
          size="small"
          variant="contained"
          color="primary"
          className={className}
          onClick={onClick}
          disabled={disabled}
          aria-label={`Promote ${envName} to ${target.name}`}
        >
          {isPromoting ? 'Promoting...' : 'Promote'}
        </Button>
      </span>
    </Tooltip>
  );
}

interface PromoteMenuItemRowProps {
  target: PromoteTarget;
  promoted: boolean;
  inFlight: boolean;
  onClick: () => void;
}

/**
 * Single MenuItem inside the multi-target promote dropdown. Same ABAC story
 * as the single-target button — one hook call per target row.
 */
function PromoteMenuItemRow({
  target,
  promoted,
  inFlight,
  onClick,
}: PromoteMenuItemRowProps) {
  const targetEnvName = target.resourceName ?? target.name;
  const { canPromote, loading, deniedTooltip } =
    useResourcePromoteToEnvPermission(targetEnvName);
  let label: string;
  if (promoted) {
    label = `Promoted to ${target.name}`;
  } else if (inFlight) {
    label = `Promoting to ${target.name}...`;
  } else {
    label = `Promote to ${target.name}`;
  }
  const permDenied = !loading && !canPromote;
  const disabled = promoted || inFlight || loading || !canPromote;
  const tooltip = permDenied ? deniedTooltip : '';
  return (
    <Tooltip
      title={tooltip}
      disableHoverListener={!tooltip}
      placement="left"
      PopperProps={{ disablePortal: true }}
    >
      <span>
        <MenuItem disabled={disabled} onClick={onClick}>
          {label}
        </MenuItem>
      </span>
    </Tooltip>
  );
}
