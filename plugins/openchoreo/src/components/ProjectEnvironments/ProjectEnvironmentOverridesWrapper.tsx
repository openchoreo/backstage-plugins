import { useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Box, Typography } from '@material-ui/core';
import { ProjectEnvironmentOverridesPage } from './ProjectEnvironmentOverridesPage';

/**
 * Routing wrapper for `ProjectEnvironmentOverridesPage`. Mounted at
 * `/deploy/overrides/:envName` by the entity tab's router.
 *
 * Search params:
 * - `release`: pins the binding to this release in deploy or promote mode.
 * - `action`: `deploy` or `promote` selects the corresponding mode; any
 *   other value runs the default edit-existing-overrides mode.
 */
export const ProjectEnvironmentOverridesWrapper = () => {
  const navigate = useNavigate();
  const { envName } = useParams<{ envName: string }>();
  const [searchParams] = useSearchParams();

  // Path-relative so `..` strips a URL segment instead of climbing the
  // parent route hierarchy.
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

  const action = searchParams.get('action');
  const release = searchParams.get('release') ?? undefined;
  const pageAction =
    action === 'deploy' || action === 'promote' ? action : undefined;
  const releaseFromUrl = pageAction ? release : undefined;

  return (
    <ProjectEnvironmentOverridesPage
      envName={envName}
      releaseFromUrl={releaseFromUrl}
      action={pageAction}
      onBack={back}
      onSaved={back}
    />
  );
};
