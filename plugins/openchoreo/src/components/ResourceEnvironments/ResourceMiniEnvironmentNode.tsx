import {
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import {
  Box,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@material-ui/core';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import RefreshIcon from '@material-ui/icons/Refresh';
import SettingsOutlinedIcon from '@material-ui/icons/SettingsOutlined';
import StorageOutlinedIcon from '@material-ui/icons/StorageOutlined';
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
  const { refetch } = useResourceEnvironmentsContext();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const hasBinding = Boolean(env.bindingName);
  const badgeStatus = deriveResourceEnvBadgeStatus(env);
  const relativeDeployed = env.lastDeployed
    ? formatRelativeTime(env.lastDeployed)
    : null;

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
              <StorageOutlinedIcon
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
        <MenuItem
          onClick={handleConfigureOverrides}
          disabled={!hasBinding}
        >
          <SettingsOutlinedIcon fontSize="small" style={{ marginRight: 8 }} />
          Configure overrides
        </MenuItem>
      </Menu>
    </Box>
  );
};
