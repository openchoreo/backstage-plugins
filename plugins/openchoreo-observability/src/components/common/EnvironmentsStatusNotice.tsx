import { Button, Typography } from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import {
  ForbiddenState,
  type ProjectEnvironmentsStatus,
} from '@openchoreo/backstage-plugin-react';
import { useEnvironmentsStatusNoticeStyles } from './styles';

export interface EnvironmentsStatusNoticeProps {
  /** The environments-resolution status from `useProjectEnvironments`. */
  status: ProjectEnvironmentsStatus;
  /** Retry callback for the `unavailable` case. */
  onRetry?: () => void;
}

/**
 * Renders a cause-specific notice when a project's environments can't be
 * shown, so observability pages explain *what happened* instead of a generic
 * "no environments found". Returns `null` for the `ok` status.
 */
export const EnvironmentsStatusNotice = ({
  status,
  onRetry,
}: EnvironmentsStatusNoticeProps) => {
  const classes = useEnvironmentsStatusNoticeStyles();

  if (status === 'ok') {
    return null;
  }

  if (status === 'forbidden') {
    return (
      <ForbiddenState
        message="You do not have permission to view this project's deployment pipeline."
        variant="compact"
      />
    );
  }

  if (status === 'empty-pipeline') {
    return (
      <Alert severity="info" className={classes.container}>
        <Typography variant="body1">
          This project's deployment pipeline has no environments configured, so
          there's nothing to show here yet. Add environments to the pipeline to
          get started.
        </Typography>
      </Alert>
    );
  }

  // status === 'unavailable'
  return (
    <Alert severity="error" className={classes.container}>
      <Typography variant="body1">
        Couldn't load this project's deployment pipeline. It may be missing or
        misconfigured.
      </Typography>
      {onRetry && (
        <Button onClick={onRetry} color="inherit" size="small">
          Retry
        </Button>
      )}
    </Alert>
  );
};
