import { Box, Typography, Button } from '@material-ui/core';
import RefreshIcon from '@material-ui/icons/Refresh';
import { useTracesActionsStyles } from './styles';

interface TracesActionsProps {
  totalCount: number;
  disabled: boolean;
  onRefresh: () => void;
}

export const TracesActions = ({
  totalCount,
  disabled,
  onRefresh,
}: TracesActionsProps) => {
  const classes = useTracesActionsStyles();

  return (
    <Box className={classes.statsContainer}>
      <Box>
        <Typography variant="body2" color="textSecondary">
          Total traces: {totalCount}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Last updated at: {new Date().toLocaleString()}
        </Typography>
      </Box>
      <Box className={classes.actionsContainer}>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={onRefresh}
          disabled={disabled}
        >
          Refresh
        </Button>
        {/* TODO: Add Auto Refresh Button, Sort Button and Download Button */}
      </Box>
    </Box>
  );
};
