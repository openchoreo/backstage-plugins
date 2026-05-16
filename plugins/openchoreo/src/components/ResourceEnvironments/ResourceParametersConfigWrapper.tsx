import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ResourceParametersConfigPage } from './ResourceParametersConfigPage';

/**
 * Routing wrapper for `ResourceParametersConfigPage`. Mounted at
 * `/environments/parameters-config` by the entity tab's router. Hands
 * the page back to the deploy list on both Back and Saved.
 *
 * Phase B-3 will replace `onSaved` with a navigation to the Step 2
 * overrides wizard for the first env in the pipeline.
 */
export const ResourceParametersConfigWrapper = () => {
  const navigate = useNavigate();
  const back = useCallback(() => navigate('..'), [navigate]);
  return <ResourceParametersConfigPage onBack={back} onSaved={back} />;
};
