import { Box, Tooltip, Typography } from '@material-ui/core';
import SettingsOutlinedIcon from '@material-ui/icons/SettingsOutlined';
import ReportProblemOutlinedIcon from '@material-ui/icons/ReportProblemOutlined';
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
  hasError,
}: SetupCardProps) => {
  const classes = useSetupCardCompactStyles();
  return (
    <Box
      className={clsx(classes.setupCard, {
        [classes.cardSelected]: selected,
        [classes.cardError]: hasError && !selected,
      })}
    >
      <span className={classes.startBadge}>Start</span>
      {hasError && (
        <Tooltip
          title="Auto-deploy failed — open Set up for details"
          placement="top"
          arrow
        >
          <ReportProblemOutlinedIcon
            className={classes.errorMarker}
            aria-label="Auto-deploy failed"
          />
        </Tooltip>
      )}
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
