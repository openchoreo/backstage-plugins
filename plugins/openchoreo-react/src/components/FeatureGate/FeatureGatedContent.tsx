import { ReactNode } from 'react';
import { EmptyState } from '@backstage/core-components';
import type { FeatureName } from '@openchoreo/backstage-plugin-common';
import { useOpenChoreoFeatures } from '../../hooks/useOpenChoreoFeatures';

export interface FeatureGatedContentProps {
  feature: FeatureName;
  children: ReactNode;
}

/**
 * Routable variant of {@link FeatureGate}. Returns an {@link EmptyState} when
 * the feature is disabled instead of `null`, so it remains valid as the body
 * of a routable extension (`EntityContentBlueprint` loader, etc.).
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
      secretManagement: 'Secret Management',
      assistant: 'Portal Assistant',
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
