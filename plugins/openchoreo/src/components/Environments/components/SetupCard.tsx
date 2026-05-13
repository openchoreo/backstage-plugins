import { Box, Typography } from '@material-ui/core';
import SettingsOutlinedIcon from '@material-ui/icons/SettingsOutlined';
import clsx from 'clsx';
import { useSetupCardCompactStyles } from '../styles';
import { SetupCardProps } from '../types';
import { LoadingSkeleton } from './LoadingSkeleton';

/**
 * Compact passive tile rendered on the deploy minimap canvas. All Setup
 * actions (Auto Deploy, Create release, Edit workload, Deploy) live in the
 * right-pane SetupDetailPane when the tile is selected — the canvas stays
 * action-free.
 */
export const SetupCard = ({
  loading,
  environmentsExist,
  selected,
}: SetupCardProps) => {
  const classes = useSetupCardCompactStyles();
  return (
    <Box
      className={clsx(classes.setupCard, {
        [classes.cardSelected]: selected,
      })}
    >
      <span className={classes.startBadge}>Start</span>
      <Box className={classes.titleRow}>
        <SettingsOutlinedIcon className={classes.titleIcon} />
        <Typography className={classes.title}>Set up</Typography>
      </Box>
      {loading && !environmentsExist ? (
        <LoadingSkeleton variant="setup" />
      ) : (
        <Typography className={classes.hint}>Releases & deployment</Typography>
      )}
    </Box>
  );
};
