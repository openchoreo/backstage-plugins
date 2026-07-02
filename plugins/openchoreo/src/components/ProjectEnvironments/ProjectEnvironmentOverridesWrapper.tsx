import { useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Box, Typography } from '@material-ui/core';
import { ProjectEnvironmentOverridesPage } from './ProjectEnvironmentOverridesPage';

/**
 * Routing wrapper for `ProjectEnvironmentOverridesPage`. Mounted at
 * `/deploy/overrides/:envName` by the entity tab's router.
 *
 * Search params:
 * - `release`: when present (and `action=deploy`), the wizard runs in
 *   deploy mode and pins the binding to this release. Used by the wizard
 *   chain that follows a project parameter edit.
 * - `action`: `deploy` selects deploy mode; any other value runs the
 *   default edit-existing-overrides mode.
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
  const releaseFromUrl = action === 'deploy' ? release : undefined;

  return (
    <ProjectEnvironmentOverridesPage
      envName={envName}
      releaseFromUrl={releaseFromUrl}
      onBack={back}
      onSaved={back}
    />
  );
};
