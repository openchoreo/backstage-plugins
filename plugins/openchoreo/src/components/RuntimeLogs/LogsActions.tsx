import { Box, Typography, Button } from '@material-ui/core';
import Refresh from '@material-ui/icons/Refresh';
import { useLogsActionsStyles } from './styles';

interface LogsActionsProps {
  totalCount: number;
  disabled: boolean;
  onRefresh: () => void;
}

export const LogsActions = ({
  totalCount,
  disabled,
  onRefresh,
}: LogsActionsProps) => {
  const classes = useLogsActionsStyles();

  return (
    <Box className={classes.statsContainer}>
      <Box>
        <Typography variant="body2" color="textSecondary">
          Total logs: {totalCount}
        </Typography>
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
        {/* TODO: Add Auto Refresh Button, Sort Button and Download Button */}
      </Box>
    </Box>
  );
};
