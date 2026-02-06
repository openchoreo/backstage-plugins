import { Chip, CircularProgress } from '@material-ui/core';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorIcon from '@material-ui/icons/Error';
import ScheduleIcon from '@material-ui/icons/Schedule';
import { useWorkflowStyles } from '../WorkflowDetailsRenderer/styles';

export const BuildStatusChip = ({ status }: { status?: string }) => {
  const classes = useWorkflowStyles();
  const statusType = status?.toLowerCase();

  switch (statusType) {
    case 'completed':
      return (
        <Chip
          icon={<CheckCircleIcon style={{ color: '#2e7d32' }} />}
          label={status}
          size="small"
          className={`${classes.statusChip} ${classes.successChip}`}
        />
      );
    case 'succeeded':
      return (
        <Chip
          icon={<CheckCircleIcon style={{ color: '#2e7d32' }} />}
          label={status}
          size="small"
          className={`${classes.statusChip} ${classes.successChip}`}
        />
      );
    case 'failed':
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
