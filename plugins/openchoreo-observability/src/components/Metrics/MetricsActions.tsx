import { Box, Typography, Button, makeStyles } from '@material-ui/core';
import Refresh from '@material-ui/icons/Refresh';
// import { useLogsActionsStyles } from './styles';

interface MetricsActionsProps {
  // totalCount: number;
  // disabled: boolean;
  // onRefresh: () => void;
}

export const MetricsActions = ({
  // totalCount,
  // disabled,
  // onRefresh,
}: MetricsActionsProps) => {

  const styles = {
    statsContainer: {
      marginTop: 16,
      marginBottom: 16,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    actionsContainer: {
      display: 'flex',
      gap: 16,
      alignItems: 'center',
    },
  };

  const classes = makeStyles(styles)();
  return (
    <Box className={classes.statsContainer}>
      <Box>
        {/* <Typography variant="body2" color="textSecondary">
          Total logs: {totalCount}
        </Typography> */}
        <Typography variant="body2" color="textSecondary">
          Last updated at: {new Date().toLocaleString()}
        </Typography>
      </Box>
      <Box className={classes.actionsContainer}>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={() => {}}
        >
          Refresh
        </Button>
        {/* TODO: Add Auto Refresh Button, Sort Button and Download Button */}
      </Box>
    </Box>
  );
};
