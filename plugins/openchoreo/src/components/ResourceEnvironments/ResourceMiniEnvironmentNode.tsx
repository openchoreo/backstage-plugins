import { type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Box, Tooltip, Typography } from '@material-ui/core';
import clsx from 'clsx';
import { StatusBadge } from '@openchoreo/backstage-design-system';
import type { ResourceEnvironment } from '../../api/OpenChoreoClientApi';
import { useResourceMiniEnvironmentNodeStyles } from './styles';
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
  const hasBinding = Boolean(env.bindingName);
  const badgeStatus = deriveResourceEnvBadgeStatus(env);
  const isBehindLatest =
    hasBinding &&
    Boolean(env.latestRelease) &&
    env.resourceRelease !== env.latestRelease;

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect();
    }
  };

  return (
    <Box
      className={clsx(classes.tile, selected && classes.selected)}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Select environment ${env.name}`}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
    >
      <Box className={classes.header}>
        <Typography variant="body2" className={classes.envName}>
          {env.name}
        </Typography>
        <StatusBadge status={badgeStatus} />
      </Box>
      {hasBinding ? (
        <>
          <Box display="flex" alignItems="center" gridGap={6}>
            <Typography className={classes.meta}>Release</Typography>
            {isBehindLatest && (
              <Tooltip
                title={`Behind latest release ${env.latestRelease}. Click Promote in the detail panel to advance.`}
              >
                <span className={classes.driftBadge}>Behind</span>
              </Tooltip>
            )}
          </Box>
          <Typography className={classes.release}>
            {env.resourceRelease || '(unset)'}
          </Typography>
        </>
      ) : (
        <Typography className={classes.empty}>Not deployed</Typography>
      )}
    </Box>
  );
};

