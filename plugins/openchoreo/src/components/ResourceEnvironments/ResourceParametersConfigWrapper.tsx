import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ResourceParametersConfigPage } from './ResourceParametersConfigPage';

/**
 * Routing wrapper for `ResourceParametersConfigPage`. Mounted at
 * `/environments/parameters-config` by the entity tab's router. Back
 * returns to the deploy view; Continue hands off to the overrides wizard
 * for the first env in the pipeline, pinned to the freshly-cut release.
 */
export const ResourceParametersConfigWrapper = () => {
  const navigate = useNavigate();

  // Path-relative so `..` strips a URL segment instead of climbing the
  // parent route hierarchy.
  const back = useCallback(
    () => navigate('..', { relative: 'path' }),
    [navigate],
  );

  const continueToOverrides = useCallback(
    (firstEnvRef: string, releaseName: string) => {
      navigate(
        `../overrides/${encodeURIComponent(firstEnvRef)}?action=deploy&release=${encodeURIComponent(releaseName)}`,
        { relative: 'path' },
      );
    },
    [navigate],
  );

  return (
    <ResourceParametersConfigPage onBack={back} onContinue={continueToOverrides} />
  );
};
