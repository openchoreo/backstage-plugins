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
import { formatRelativeTime } from '@openchoreo/backstage-plugin-react';
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
  const badgeStatus = deriveResourceEnvBadgeStatus(env);
  const relativeDeployed = env.lastDeployed
    ? formatRelativeTime(env.lastDeployed)
    : null;

  // Card-level Promote pushes this env's release FORWARD to the next env
  // in the pipeline (mirrors Component). Distinct from the detail panel's
  // Promote, which advances this binding to the latest ResourceRelease
  // when the Resource spec has drifted ahead.
  const promotionTargets = env.promotionTargets ?? [];
  const hasPromotionTargets = promotionTargets.length > 0;
  const eligibleTargets = hasRelease
    ? promotionTargets.filter(t => {
        const targetEnv = environments.find(e => e.name === t.name);
        return targetEnv?.resourceRelease !== env.resourceRelease;
      })
    : [];
  const isReady = env.status === 'Ready';
  const isPromotingForward = promotionTargets.some(
    t =>
      pendingAction?.kind === 'promote' &&
      pendingAction.env === (t.resourceName ?? t.name),
  );
  const showPromote =
    hasBinding && hasRelease && isReady && hasPromotionTargets;
  const allTargetsInSync =
    hasPromotionTargets && eligibleTargets.length === 0;

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
                      Behind {drift!.aheadUpstreams.map(u => u.envName).join(', ')}
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
            <Box className={classes.actionRow}>
              {allTargetsInSync ? (
                <Button
                  size="small"
                  variant="contained"
                  disabled
                  className={classes.primaryButton}
                >
                  Promoted
                </Button>
              ) : promotionTargets.length === 1 ? (
                <Button
                  size="small"
                  variant="contained"
                  color="primary"
                  className={classes.primaryButton}
                  onClick={handlePromoteSingle}
                  disabled={isPromotingForward}
                  aria-label={`Promote ${env.name} to ${eligibleTargets[0].name}`}
                >
                  {isPromotingForward ? 'Promoting...' : 'Promote'}
                </Button>
              ) : (
                <Button
                  size="small"
                  variant="contained"
                  color="primary"
                  className={classes.primaryButton}
                  endIcon={<ArrowDropDownIcon fontSize="small" />}
                  onClick={openPromoteMenu}
                  disabled={isPromotingForward}
                  aria-haspopup="true"
                  aria-label={`Promote ${env.name}`}
                >
                  {isPromotingForward ? 'Promoting...' : 'Promote'}
                </Button>
              )}
            </Box>
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
        <MenuItem
          onClick={handleConfigureOverrides}
          disabled={!hasBinding}
        >
          <SettingsOutlinedIcon fontSize="small" style={{ marginRight: 8 }} />
          Configure overrides
        </MenuItem>
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
        {promotionTargets.map(target => {
          const promoted = isTargetAlreadyPromoted(target.name);
          const inFlight = isTargetInFlight(target.resourceName ?? target.name);
          let label: string;
          if (promoted) {
            label = `Promoted to ${target.name}`;
          } else if (inFlight) {
            label = `Promoting to ${target.name}...`;
          } else {
            label = `Promote to ${target.name}`;
          }
          return (
            <MenuItem
              key={target.name}
              onClick={() => handlePromoteTo(target)}
              disabled={promoted || inFlight}
            >
              {label}
            </MenuItem>
          );
        })}
      </Menu>
    </Box>
  );
};
