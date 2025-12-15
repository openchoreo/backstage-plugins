import { ReactNode } from 'react';
import { useOpenChoreoFeatures } from '@openchoreo/backstage-plugin-react';
import type { FeatureName } from '@openchoreo/backstage-plugin-common';
import { EmptyState } from '@backstage/core-components';

interface FeatureGatedContentProps {
  feature: FeatureName;
  children: ReactNode;
}

/**
 * Wrapper component for feature-gated route content.
 *
 * Unlike FeatureGate which conditionally renders children,
 * this component always renders something (either the children or an empty state).
 * This is required for routable extensions that must be present in the element tree.
 *
 * When the feature is disabled, shows an empty state message instead of the content.
 */
export function FeatureGatedContent({
  feature,
  children,
}: FeatureGatedContentProps) {
  const features = useOpenChoreoFeatures();
  const isEnabled = features[feature]?.enabled ?? true;

  if (!isEnabled) {
    const featureNames: Record<FeatureName, string> = {
      workflows: 'Workflows',
      observability: 'Observability',
      auth: 'Authentication',
      authz: 'Authorization',
    };

    return (
      <EmptyState
        title={`${featureNames[feature]} Disabled`}
        description={`The ${featureNames[
          feature
        ].toLowerCase()} feature is currently disabled in this environment.`}
        missing="info"
      />
    );
  }

  return <>{children}</>;
}
