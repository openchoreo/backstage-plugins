import { Box, Typography } from '@material-ui/core';
import SettingsOutlinedIcon from '@material-ui/icons/SettingsOutlined';
import clsx from 'clsx';
import { useResourceSetupCardCompactStyles } from './styles';

interface ResourceSetupCardProps {
  selected: boolean;
}

/**
 * Compact `Set up` tile rendered as the leftmost node on the Resource
 * deploy DAG. Clicking it selects the tile and opens
 * `ResourceSetupDetailPane` in the right pane; the tile itself stays
 * passive so the canvas remains action-free.
 */
export const ResourceSetupCard = ({ selected }: ResourceSetupCardProps) => {
  const classes = useResourceSetupCardCompactStyles();
  return (
    <Box
      className={clsx(classes.setupCard, {
        [classes.cardSelected]: selected,
      })}
    >
      <Box className={classes.titleRow}>
        <SettingsOutlinedIcon className={classes.titleIcon} />
        <Typography className={classes.title}>Set up</Typography>
      </Box>
      <Typography className={classes.hint}>
        Resource configuration
      </Typography>
    </Box>
  );
};
