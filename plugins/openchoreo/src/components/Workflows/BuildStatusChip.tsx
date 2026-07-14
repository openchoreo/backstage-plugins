import { Chip } from '@material-ui/core';
import { Spinner } from '@openchoreo/backstage-design-system';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorIcon from '@material-ui/icons/Error';
import ScheduleIcon from '@material-ui/icons/Schedule';
import { useWorkflowStyles } from './styles';

export const BuildStatusChip = ({ status }: { status?: string }) => {
  const classes = useWorkflowStyles();
  const statusLower = status?.toLowerCase() || '';

  if (
    statusLower.includes('success') ||
    statusLower.includes('succeeded') ||
    statusLower.includes('completed') ||
    statusLower.includes('complete')
  ) {
    return (
      <Chip
        icon={<CheckCircleIcon style={{ color: '#2e7d32' }} />}
        label={status}
        size="small"
        className={`${classes.statusChip} ${classes.successChip}`}
      />
    );
  }

  if (statusLower.includes('fail') || statusLower.includes('error')) {
    return (
      <Chip
        icon={<ErrorIcon style={{ color: '#c62828' }} />}
        label={status}
        size="small"
        className={`${classes.statusChip} ${classes.errorChip}`}
      />
    );
  }

  if (statusLower.includes('running') || statusLower.includes('progress')) {
    return (
      <Chip
        icon={<Spinner size="chip" color="inherit" />}
        label={status}
        size="small"
        className={`${classes.statusChip} ${classes.runningChip}`}
      />
    );
  }

  if (statusLower.includes('pending') || statusLower.includes('queued')) {
    return (
      <Chip
        icon={<ScheduleIcon style={{ color: '#e65100' }} />}
        label={status}
        size="small"
        className={`${classes.statusChip} ${classes.pendingChip}`}
      />
    );
  }

  return (
    <Chip
      icon={<ScheduleIcon style={{ color: '#e65100' }} />}
      label={status || 'Unknown'}
      size="small"
      className={`${classes.statusChip} ${classes.pendingChip}`}
    />
  );
};
