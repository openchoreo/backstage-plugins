import type { FC } from 'react';
import {
  StatusOK,
  StatusError,
  StatusPending,
  StatusRunning,
} from '@backstage/core-components';

interface BuildStatusComponentProps {
  status?: string;
}

/**
 * Renders a status badge for build status.
 */
export const BuildStatusComponent: FC<BuildStatusComponentProps> = ({
  status,
}) => {
  if (!status) {
    return <StatusPending>Unknown</StatusPending>;
  }

  const normalizedStatus = status.toLowerCase();

  if (
    normalizedStatus.includes('succeed') ||
    normalizedStatus.includes('success')
  ) {
    return <StatusOK>Success</StatusOK>;
  }

  if (normalizedStatus.includes('fail') || normalizedStatus.includes('error')) {
    return <StatusError>Failed</StatusError>;
  }

  if (
    normalizedStatus.includes('running') ||
    normalizedStatus.includes('progress')
  ) {
    return <StatusRunning>Running</StatusRunning>;
  }

  return <StatusPending>{status}</StatusPending>;
};
