import { useEntity } from '@backstage/plugin-catalog-react';

/**
 * Hook to get an annotation value from the current entity.
 *
 * @param annotationKey - The annotation key to look up (e.g., 'jenkins.io/job-full-name')
 * @returns The annotation value, or undefined if not present
 *
 * @example
 * ```tsx
 * const jenkinsJob = useEntityAnnotation('jenkins.io/job-full-name');
 * if (jenkinsJob) {
 *   // Show Jenkins integration
 * }
 * ```
 */
export function useEntityAnnotation(annotationKey: string): string | undefined {
  const { entity } = useEntity();
  return entity.metadata.annotations?.[annotationKey];
}

/**
 * Hook to check if an annotation is present on the current entity.
 *
 * @param annotationKey - The annotation key to check
 * @returns true if the annotation is present (even if empty string), false otherwise
 *
 * @example
 * ```tsx
 * const hasJenkins = useHasAnnotation('jenkins.io/job-full-name');
 * ```
 */
export function useHasAnnotation(annotationKey: string): boolean {
  const value = useEntityAnnotation(annotationKey);
  return value !== undefined;
}

/**
 * Hook to check if any of the given annotations are present on the current entity.
 *
 * @param annotationKeys - Array of annotation keys to check
 * @returns true if at least one annotation is present
 *
 * @example
 * ```tsx
 * const hasCI = useHasAnyAnnotation([
 *   'jenkins.io/job-full-name',
 *   'github.com/project-slug',
 *   'gitlab.com/project-slug',
 * ]);
 * ```
 */
export function useHasAnyAnnotation(annotationKeys: string[]): boolean {
  const { entity } = useEntity();
  return annotationKeys.some(
    key => entity.metadata.annotations?.[key] !== undefined,
  );
}
