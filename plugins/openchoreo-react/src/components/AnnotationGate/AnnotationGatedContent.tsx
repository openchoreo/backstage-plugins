import { ReactNode } from 'react';
import { EmptyState } from '@backstage/core-components';
import {
  useHasAnnotation,
  useHasAnyAnnotation,
} from '../../hooks/useEntityAnnotation';

/**
 * Props for the AnnotationGatedContent component.
 */
export interface AnnotationGatedContentProps {
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
  /** Title for the empty state when annotation is missing */
  missingAnnotationTitle?: string;
  /** Description for the empty state when annotation is missing */
  missingAnnotationDescription?: string;
}

/**
 * Wrapper component for annotation-gated route content.
 *
 * Unlike AnnotationGate which can return null, this component always renders
 * something (either the children or an empty state). This is required for
 * routable extensions that must be present in the element tree.
 *
 * Use this for tab content where an empty state should be shown when the
 * required annotation is not configured.
 *
 * @example
 * ```tsx
 * <EntityLayout.Route path="/jenkins" title="Jenkins">
 *   <AnnotationGatedContent
 *     annotation="jenkins.io/job-full-name"
 *     missingAnnotationTitle="Jenkins Not Configured"
 *     missingAnnotationDescription="Add the jenkins.io/job-full-name annotation to view Jenkins builds."
 *   >
 *     <EntityJenkinsContent />
 *   </AnnotationGatedContent>
 * </EntityLayout.Route>
 * ```
 */
export function AnnotationGatedContent({
  annotation,
  annotations,
  children,
  missingAnnotationTitle = 'Annotation Required',
  missingAnnotationDescription,
}: AnnotationGatedContentProps) {
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
    const annotationList = annotation ? [annotation] : annotations ?? [];
    const defaultDescription =
      annotationList.length === 1
        ? `Add the ${annotationList[0]} annotation to this entity to enable this feature.`
        : `Add one of the following annotations to this entity: ${annotationList.join(
            ', ',
          )}`;

    return (
      <EmptyState
        title={missingAnnotationTitle}
        description={missingAnnotationDescription ?? defaultDescription}
        missing="info"
      />
    );
  }

  return <>{children}</>;
}
