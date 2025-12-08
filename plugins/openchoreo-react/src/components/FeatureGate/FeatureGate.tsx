import { ReactNode, ComponentType, FC } from 'react';
import type { FeatureName } from '@openchoreo/backstage-plugin-common';
import { useOpenChoreoFeatures } from '../../hooks/useOpenChoreoFeatures';

/**
 * Props for the FeatureGate component.
 */
export interface FeatureGateProps {
  /** The feature to check */
  feature: FeatureName;
  /** Content to render when the feature is enabled */
  children: ReactNode;
  /** Optional content to render when the feature is disabled */
  fallback?: ReactNode;
}

/**
 * Component that conditionally renders children based on feature flags.
 *
 * Use this to wrap UI elements that should only appear when a feature is enabled.
 *
 * @example
 * ```tsx
 * <FeatureGate feature="workflows">
 *   <WorkflowsOverviewCard />
 * </FeatureGate>
 *
 * // With fallback content
 * <FeatureGate feature="observability" fallback={<DisabledMessage />}>
 *   <ObservabilityMetrics />
 * </FeatureGate>
 * ```
 */
export function FeatureGate({
  feature,
  children,
  fallback = null,
}: FeatureGateProps) {
  const features = useOpenChoreoFeatures();

  const isEnabled = features[feature]?.enabled ?? true;

  if (!isEnabled) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Higher-order component version of FeatureGate.
 *
 * Use this to wrap entire components that should only render when a feature is enabled.
 *
 * @example
 * ```tsx
 * const GatedWorkflows = withFeatureGate('workflows', Workflows);
 * // Later: <GatedWorkflows />
 * ```
 */
export function withFeatureGate<P extends object>(
  feature: FeatureName,
  Component: ComponentType<P>,
  Fallback?: ComponentType<P>,
): FC<P> {
  return function FeatureGatedComponent(props: P) {
    const features = useOpenChoreoFeatures();
    const isEnabled = features[feature]?.enabled ?? true;

    if (!isEnabled) {
      return Fallback ? <Fallback {...props} /> : null;
    }

    return <Component {...props} />;
  };
}
