import { ReactNode, ComponentType, FC } from 'react';
import {
  useHasAnnotation,
  useHasAnyAnnotation,
} from '../../hooks/useEntityAnnotation';

/**
 * Props for the AnnotationGate component.
 */
export interface AnnotationGateProps {
  /**
   * The annotation key to check.
   * Mutually exclusive with `annotations`.
   */
  annotation?: string;
  /**
   * Multiple annotation keys to check (any match will render children).
   * Mutually exclusive with `annotation`.
   */
  annotations?: string[];
  /** Content to render when the annotation is present */
  children: ReactNode;
  /** Optional content to render when the annotation is missing */
  fallback?: ReactNode;
}

/**
 * Component that conditionally renders children based on entity annotations.
 *
 * Use this to wrap UI elements that should only appear when an annotation is present.
 * Cards in overview pages should use this with no fallback (renders nothing when missing).
 *
 * @example
 * ```tsx
 * // Single annotation check
 * <AnnotationGate annotation="jenkins.io/job-full-name">
 *   <EntityLatestJenkinsRunCard />
 * </AnnotationGate>
 *
 * // Multiple annotations (any match)
 * <AnnotationGate annotations={['gitlab.com/project-slug', 'gitlab.com/project-id']}>
 *   <EntityGitlabContent />
 * </AnnotationGate>
 *
 * // With fallback content
 * <AnnotationGate annotation="pagerduty.com/service-id" fallback={<SetupPagerDutyCard />}>
 *   <EntityPagerDutyCard />
 * </AnnotationGate>
 * ```
 */
export function AnnotationGate({
  annotation,
  annotations,
  children,
  fallback = null,
}: AnnotationGateProps) {
  // Support both single annotation and multiple annotations
  const hasSingleAnnotation = useHasAnnotation(annotation ?? '');
  const hasAnyAnnotations = useHasAnyAnnotation(annotations ?? []);

  // Determine if the required annotation(s) are present
  let hasAnnotation = false;
  if (annotation) {
    hasAnnotation = hasSingleAnnotation;
  } else if (annotations) {
    hasAnnotation = hasAnyAnnotations;
  }

  if (!hasAnnotation) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Higher-order component version of AnnotationGate.
 *
 * Use this to wrap entire components that should only render when an annotation is present.
 *
 * @example
 * ```tsx
 * const GatedJenkinsCard = withAnnotationGate(
 *   'jenkins.io/job-full-name',
 *   EntityLatestJenkinsRunCard
 * );
 * // Later: <GatedJenkinsCard />
 * ```
 */
export function withAnnotationGate<P extends object>(
  annotation: string,
  Component: ComponentType<P>,
  Fallback?: ComponentType<P>,
): FC<P> {
  return function AnnotationGatedComponent(props: P) {
    const hasAnnotation = useHasAnnotation(annotation);

    if (!hasAnnotation) {
      return Fallback ? <Fallback {...props} /> : null;
    }

    return <Component {...props} />;
  };
}
