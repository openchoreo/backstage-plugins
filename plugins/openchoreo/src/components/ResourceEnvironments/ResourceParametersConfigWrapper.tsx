import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ResourceParametersConfigPage } from './ResourceParametersConfigPage';

/**
 * Routing wrapper for `ResourceParametersConfigPage`. Mounted at
 * `/environments/parameters-config` by the entity tab's router. Hands
 * the page back to the deploy list on both Back and Saved.
 */
export const ResourceParametersConfigWrapper = () => {
  const navigate = useNavigate();
  // Path-relative so `..` strips a URL segment instead of climbing the
  // parent route hierarchy.
  const back = useCallback(
    () => navigate('..', { relative: 'path' }),
    [navigate],
  );
  return <ResourceParametersConfigPage onBack={back} onSaved={back} />;
};
