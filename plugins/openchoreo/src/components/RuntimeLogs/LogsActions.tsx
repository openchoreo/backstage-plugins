import { Box, Typography, Button } from '@material-ui/core';
import Refresh from '@material-ui/icons/Refresh';
import Autorenew from '@material-ui/icons/Autorenew';
import { useLogsActionsStyles } from './styles';

interface LogsActionsProps {
  totalCount: number;
  autoRefresh: boolean;
  disabled: boolean;
  onRefresh: () => void;
  onAutoRefreshToggle: () => void;
}

export const LogsActions = ({
  totalCount,
  autoRefresh,
  disabled,
  onRefresh,
  onAutoRefreshToggle,
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
        <Button
          variant={autoRefresh ? 'contained' : 'outlined'}
          color={autoRefresh ? 'primary' : 'default'}
          startIcon={<Autorenew />}
          onClick={onAutoRefreshToggle}
          disabled={disabled}
        >
          {autoRefresh ? 'Auto Refresh: ON' : 'Auto Refresh: OFF'}
        </Button>
        {/* TODO: Add Sort Button and Download Button */}
      </Box>
    </Box>
  );
};
