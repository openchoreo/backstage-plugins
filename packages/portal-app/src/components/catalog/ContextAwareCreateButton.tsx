import { Button, Tooltip } from '@material-ui/core';
import { Link } from 'react-router-dom';
import { useKindCreateConfig } from './useKindCreateConfig';

export const ContextAwareCreateButton = () => {
  const config = useKindCreateConfig();

  if (!config) {
    return null;
  }

  const { createPath, buttonLabel, canCreate, loading, deniedTooltip } = config;

  if (!canCreate || loading) {
    return (
      <Tooltip title={deniedTooltip}>
        <span>
          <Button variant="contained" color="primary" size="small" disabled>
            {buttonLabel}
          </Button>
        </span>
      </Tooltip>
    );
  }

  return (
    <Button
      variant="contained"
      color="primary"
      size="small"
      component={Link}
      to={createPath}
    >
      {buttonLabel}
    </Button>
  );
};
