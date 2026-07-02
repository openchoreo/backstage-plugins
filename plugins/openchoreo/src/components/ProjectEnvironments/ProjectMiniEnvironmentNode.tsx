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
import MoreVertIcon from '@material-ui/icons/MoreVert';
import RefreshIcon from '@material-ui/icons/Refresh';
import SettingsOutlinedIcon from '@material-ui/icons/SettingsOutlined';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import { StatusBadge } from '@openchoreo/backstage-design-system';
import {
  formatRelativeTime,
  useProjectUpdatePermission,
} from '@openchoreo/backstage-plugin-react';
import type { ProjectEnvironment } from '../../api/OpenChoreoClientApi';
import { useProjectMiniEnvironmentNodeStyles } from './styles';
import { useProjectEnvironmentsContext } from './ProjectEnvironmentsContext';
import { deriveProjectEnvBadgeStatus } from './badgeStatus';

interface ProjectMiniEnvironmentNodeProps {
  env: ProjectEnvironment;
  selected: boolean;
  onSelect: () => void;
}

export const ProjectMiniEnvironmentNode = ({
  env,
  selected,
  onSelect,
}: ProjectMiniEnvironmentNodeProps) => {
  const classes = useProjectMiniEnvironmentNodeStyles();
  const navigate = useNavigate();
  const { environments, pendingAction, refetch, onPromote } =
    useProjectEnvironmentsContext();
  const {
    canUpdate,
    loading: permLoading,
    updateDeniedTooltip,
  } = useProjectUpdatePermission();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [promoteAnchor, setPromoteAnchor] = useState<HTMLElement | null>(null);

  const hasBinding = Boolean(env.bindingName);
  const hasRelease = Boolean(env.projectRelease);
  const badgeStatus = deriveProjectEnvBadgeStatus(env);
  const relativeDeployed = env.lastDeployed
    ? formatRelativeTime(env.lastDeployed)
    : null;

  // Card Promote copies this env's release pin forward to the next env's
  // binding. The pipeline-defined `promotionTargets` enforces ordering: the
  // terminal env has no targets, so the button never appears there. There
  // is no skip-the-pipeline "jump to latest" operation by design.
  const promotionTargets = env.promotionTargets ?? [];
  const hasPromotionTargets = promotionTargets.length > 0;
  const eligibleTargets = hasRelease
    ? promotionTargets.filter(t => {
        const targetEnv = environments.find(e => e.name === t.name);
        return targetEnv?.projectRelease !== env.projectRelease;
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
  const promoteDisabledByPerm = permLoading || !canUpdate;
  const promoteTooltip = !canUpdate && !permLoading ? updateDeniedTooltip : '';

  // Promote needs the K8s-safe resource name (lowercase, RFC 1123).
  // target.name carries the display name (e.g. "Production") which the
  // BFF would otherwise stitch into a `metadata.name` like
  // "my-app-Production" and get 422'd by the apiserver.
  const handlePromoteSingle = (e: ReactMouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const target = eligibleTargets[0];
    if (!target || !env.projectRelease) return;
    void onPromote(target.resourceName ?? target.name, env.projectRelease);
  };

  const openPromoteMenu = (e: ReactMouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setPromoteAnchor(e.currentTarget);
  };
  const closePromoteMenu = () => setPromoteAnchor(null);

  const handlePromoteTo = (target: { name: string; resourceName?: string }) => {
    closePromoteMenu();
    if (!env.projectRelease) return;
    void onPromote(target.resourceName ?? target.name, env.projectRelease);
  };

  const isTargetAlreadyPromoted = (targetName: string) => {
    const targetEnv = environments.find(e => e.name === targetName);
    return targetEnv?.projectRelease === env.projectRelease;
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
    navigate(`overrides/${encodeURIComponent(env.resourceName ?? env.name)}`);
  };

  let overridesTooltip = '';
  if (!hasBinding) {
    overridesTooltip = 'No binding in this environment yet.';
  } else if (!canUpdate && !permLoading) {
    overridesTooltip = updateDeniedTooltip;
  }

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
    const label = isPromoting ? 'Promoting...' : 'Promote';
    if (promotionTargets.length === 1) {
      return (
        <Tooltip
          title={promoteTooltip}
          disableHoverListener={!promoteTooltip}
          PopperProps={{ disablePortal: true }}
        >
          <span>
            <Button
              size="small"
              variant="contained"
              color="primary"
              className={classes.primaryButton}
              onClick={handlePromoteSingle}
              disabled={isPromoting || promoteDisabledByPerm}
              aria-label={`Promote ${env.name} to ${eligibleTargets[0]?.name}`}
            >
              {label}
            </Button>
          </span>
        </Tooltip>
      );
    }
    return (
      <Tooltip
        title={promoteTooltip}
        disableHoverListener={!promoteTooltip}
        PopperProps={{ disablePortal: true }}
      >
        <span>
          <Button
            size="small"
            variant="contained"
            color="primary"
            className={classes.primaryButton}
            endIcon={<ArrowDropDownIcon fontSize="small" />}
            onClick={openPromoteMenu}
            disabled={isPromoting || promoteDisabledByPerm}
            aria-haspopup="true"
            aria-label={`Promote ${env.name}`}
          >
            {label}
          </Button>
        </span>
      </Tooltip>
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
        <Divider />
        <Tooltip
          title={overridesTooltip}
          placement="left"
          PopperProps={{ disablePortal: true }}
        >
          <span>
            <MenuItem
              onClick={handleConfigureOverrides}
              disabled={!hasBinding || permLoading || !canUpdate}
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
        {promotionTargets.map(target => {
          const promoted = isTargetAlreadyPromoted(target.name);
          const inFlight = isTargetInFlight(target.resourceName ?? target.name);
          let itemLabel: string;
          if (promoted) {
            itemLabel = `Promoted to ${target.name}`;
          } else if (inFlight) {
            itemLabel = `Promoting to ${target.name}...`;
          } else {
            itemLabel = `Promote to ${target.name}`;
          }
          return (
            <MenuItem
              key={target.name}
              disabled={promoted || inFlight || promoteDisabledByPerm}
              onClick={() => handlePromoteTo(target)}
            >
              {itemLabel}
            </MenuItem>
          );
        })}
      </Menu>
    </Box>
  );
};
