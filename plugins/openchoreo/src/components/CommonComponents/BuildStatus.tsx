import { Chip, CircularProgress } from '@material-ui/core';
import { ModelsBuild } from '@openchoreo/backstage-plugin-api';
import CheckIcon from '@material-ui/icons/Check';
import ErrorIcon from '@material-ui/icons/Error';

export const BuildStatus = ({ build }: { build: ModelsBuild }) => {
  const normalizedStatus = build.status?.toLowerCase() ?? '';
  if (
    normalizedStatus.includes('succeed') ||
    normalizedStatus.includes('success') ||
    normalizedStatus.includes('completed')
  ) {
    return (
      <Chip size="small" label="Success" color="primary" icon={<CheckIcon />} />
    );
  }
  if (normalizedStatus.includes('fail') || normalizedStatus.includes('error')) {
    return (
      <Chip
        size="small"
        color="secondary"
        label="Failed"
        icon={<ErrorIcon />}
      />
    );
  }
  return (
    <Chip
      size="small"
      color="default"
      label={build.status}
      icon={<CircularProgress size={16} />}
    />
  );
};
