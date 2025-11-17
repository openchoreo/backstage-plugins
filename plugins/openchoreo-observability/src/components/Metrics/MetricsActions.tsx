import { Box, Typography, Button, makeStyles } from '@material-ui/core';
import Refresh from '@material-ui/icons/Refresh';
import { metricsActionsStyles } from './styles';

interface MetricsActionsProps {
  disabled: boolean;
  onRefresh: () => void;
}

export const MetricsActions = ({
  disabled,
  onRefresh,
}: MetricsActionsProps) => {
  const classes = makeStyles(metricsActionsStyles)();
  return (
    <Box className={classes.statsContainer}>
      <Box>
        <Typography variant="body2" color="textSecondary">
          Last updated at: {new Date().toLocaleString()}
        </Typography>
      </Box>
      <Box className={classes.actionsContainer}>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={onRefresh}
          disabled={disabled}
        >
          Refresh
        </Button>
        {/* TODO: Add Auto Refresh Button */}
      </Box>
    </Box>
  );
};
