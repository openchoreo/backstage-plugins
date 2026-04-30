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
  onSuspend: () => void | Promise<void>;
  onRedeploy: () => void | Promise<void>;
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
  onSuspend,
  onRedeploy,
}: MiniEnvironmentNodeProps) => {
  const classes = useMiniEnvironmentNodeStyles();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const statusVariant = useEnvironmentStatusVariant(
    environment.deployment.status,
    environment.deployment.statusReason,
  );

  const { primaryPromotion, undeployAction } = usePromotionAction({
    environmentName: environment.name,
    bindingName: environment.bindingName,
    deploymentStatus: environment.deployment.status,
    statusReason: environment.deployment.statusReason,
    promotionTargets: environment.promotionTargets,
    isAlreadyPromoted,
    promotionTracker: actionTrackers.promotionTracker,
    suspendTracker: actionTrackers.suspendTracker,
    onPromote,
    onSuspend,
    onRedeploy,
  });

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
    setMenuAnchor(e.currentTarget);
  };
  const closeMenu = () => setMenuAnchor(null);

  const renderActions = () => {
    const buttons: JSX.Element[] = [];
    if (primaryPromotion) {
      buttons.push(
        <Tooltip
          key="promote"
          title={primaryPromotion.deniedTooltip}
          disableHoverListener={!primaryPromotion.deniedTooltip}
        >
          <span>
            <Button
              size="small"
              variant="contained"
              color="primary"
              className={classes.primaryButton}
              disabled={primaryPromotion.disabled}
              onClick={e => {
                stop(e);
                primaryPromotion.onClick();
              }}
            >
              {primaryPromotion.isPromoting
                ? 'Promoting...'
                : `Promote → ${primaryPromotion.target.name}`}
            </Button>
          </span>
        </Tooltip>,
      );
    }
    if (undeployAction?.kind === 'redeploy' && !primaryPromotion) {
      buttons.push(
        <Tooltip
          key="redeploy"
          title={undeployAction.deniedTooltip}
          disableHoverListener={!undeployAction.deniedTooltip}
        >
          <span>
            <Button
              size="small"
              variant="contained"
              color="primary"
              className={classes.primaryButton}
              disabled={undeployAction.disabled}
              onClick={e => {
                stop(e);
                undeployAction.onClick();
              }}
            >
              {undeployAction.label}
            </Button>
          </span>
        </Tooltip>,
      );
    }
    if (undeployAction?.kind === 'undeploy') {
      buttons.push(
        <Tooltip
          key="undeploy"
          title={undeployAction.deniedTooltip}
          disableHoverListener={!undeployAction.deniedTooltip}
        >
          <span>
            <Button
              size="small"
              variant="outlined"
              className={classes.primaryButton}
              disabled={undeployAction.disabled}
              onClick={e => {
                stop(e);
                undeployAction.onClick();
              }}
            >
              {undeployAction.label}
            </Button>
          </span>
        </Tooltip>,
      );
    }
    return buttons;
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
    </Box>
  );
};
