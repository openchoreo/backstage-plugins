import { Box, Typography } from '@material-ui/core';
import SettingsOutlinedIcon from '@material-ui/icons/SettingsOutlined';
import clsx from 'clsx';
import { useProjectSetupCardCompactStyles } from './styles';

interface ProjectSetupCardProps {
  selected: boolean;
}

/**
 * Compact `Set up` tile rendered as the leftmost node on the Project
 * deploy DAG. Clicking it selects the tile and opens
 * `ProjectSetupDetailPane` in the right pane; the tile itself stays
 * passive so the canvas remains action-free.
 */
export const ProjectSetupCard = ({ selected }: ProjectSetupCardProps) => {
  const classes = useProjectSetupCardCompactStyles();
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
      <Typography className={classes.hint}>Project configuration</Typography>
    </Box>
  );
};
