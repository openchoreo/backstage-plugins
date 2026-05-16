import { useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Typography } from '@material-ui/core';
import { ResourceEnvironmentOverridesPage } from './ResourceEnvironmentOverridesPage';

/**
 * Routing wrapper for `ResourceEnvironmentOverridesPage`. Mounted at
 * `/environments/overrides/:envName` by the entity tab's router.
 */
export const ResourceEnvironmentOverridesWrapper = () => {
  const navigate = useNavigate();
  const { envName } = useParams<{ envName: string }>();
  // Use path-relative resolution so '../..' lands on the deploy view
  // (`/environments`) instead of climbing the parent route's hierarchy.
  const back = useCallback(
    () => navigate('../..', { relative: 'path' }),
    [navigate],
  );

  if (!envName) {
    return (
      <Box p={3}>
        <Typography color="error">
          Missing environment name in the route.
        </Typography>
      </Box>
    );
  }

  return (
    <ResourceEnvironmentOverridesPage
      envName={envName}
      onBack={back}
      onSaved={back}
    />
  );
};
