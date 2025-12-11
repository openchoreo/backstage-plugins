import { Box, Typography, Button } from '@material-ui/core';
import RefreshIcon from '@material-ui/icons/Refresh';
import { makeStyles, Theme } from '@material-ui/core/styles';
import { memo } from 'react';

const useRCAActionsStyles = makeStyles((theme: Theme) => ({
  statsContainer: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionsContainer: {
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'center',
  },
}));

interface RCAActionsProps {
  disabled: boolean;
  onRefresh: () => void;
  totalCount?: number;
}

export const RCAActions = memo(
  ({ disabled, onRefresh, totalCount }: RCAActionsProps) => {
    const classes = useRCAActionsStyles();

    return (
      <Box className={classes.statsContainer}>
        <Box>
          <Typography variant="body2" color="textSecondary">
            {totalCount !== undefined
              ? `Total reports: ${totalCount}`
              : 'No reports data'}
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
        </Box>
      </Box>
    );
  },
);

RCAActions.displayName = 'RCAActions';
