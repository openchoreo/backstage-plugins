import { Chip, CircularProgress } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorIcon from '@material-ui/icons/Error';
import ScheduleIcon from '@material-ui/icons/Schedule';
import type { WorkflowRunStatus } from '../../types';

const useStyles = makeStyles(theme => ({
  statusChip: {
    fontWeight: 500,
    fontSize: '0.8125rem',
    height: '24px',
  },
  successChip: {
    backgroundColor: theme.palette.success.light,
    color: theme.palette.success.dark,
    '& .MuiChip-icon': {
      color: `${theme.palette.success.dark} !important`,
    },
  },
  errorChip: {
    backgroundColor: theme.palette.error.light,
    color: theme.palette.error.dark,
    '& .MuiChip-icon': {
      color: `${theme.palette.error.dark} !important`,
    },
  },
  runningChip: {
    backgroundColor: theme.palette.secondary.light,
    color: theme.palette.info.dark,
    '& .MuiChip-icon': {
      color: `${theme.palette.info.dark} !important`,
    },
  },
  pendingChip: {
    backgroundColor: theme.palette.warning.light,
    color: theme.palette.warning.dark,
    '& .MuiChip-icon': {
      color: `${theme.palette.warning.dark} !important`,
    },
  },
}));

interface WorkflowRunStatusChipProps {
  status?: WorkflowRunStatus | string;
}

export const WorkflowRunStatusChip = ({
  status,
}: WorkflowRunStatusChipProps) => {
  const classes = useStyles();

  // Normalize status to handle case differences from API
  const normalizedStatus = status?.toLowerCase();

  switch (normalizedStatus) {
    case 'succeeded':
    case 'completed':
      return (
        <Chip
          icon={<CheckCircleIcon style={{ color: '#2e7d32' }} />}
          label={status}
          size="small"
          className={`${classes.statusChip} ${classes.successChip}`}
        />
      );
    case 'failed':
    case 'error':
      return (
        <Chip
          icon={<ErrorIcon style={{ color: '#c62828' }} />}
          label={status}
          size="small"
          className={`${classes.statusChip} ${classes.errorChip}`}
        />
      );
    case 'running':
      return (
        <Chip
          icon={<CircularProgress size={14} style={{ color: '#01579b' }} />}
          label={status}
          size="small"
          className={`${classes.statusChip} ${classes.runningChip}`}
        />
      );
    case 'pending':
      return (
        <Chip
          icon={<ScheduleIcon style={{ color: '#e65100' }} />}
          label={status}
          size="small"
          className={`${classes.statusChip} ${classes.pendingChip}`}
        />
      );
    default:
      return (
        <Chip
          icon={<ScheduleIcon style={{ color: '#e65100' }} />}
          label={status || 'Unknown'}
          size="small"
          className={`${classes.statusChip} ${classes.pendingChip}`}
        />
      );
  }
};
