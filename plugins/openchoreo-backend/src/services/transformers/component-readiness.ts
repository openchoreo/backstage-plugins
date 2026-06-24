import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';

type Component = OpenChoreoComponents['schemas']['Component'];

/**
 * Reasons on the Component Ready condition that indicate the controller is
 * still working (transient), not a terminal error. A `Ready=False` carrying
 * one of these should not be surfaced as an auto-deploy failure.
 */
const PROGRESSING_REASONS = [
  'Progressing',
  'Reconciling',
  'ResourcesProgressing',
] as const;

export interface ComponentReadiness {
  /** True when the Ready condition is False with a terminal (error) reason. */
  hasError: boolean;
  /** The Ready condition's machine-readable reason (e.g. AutoDeployFailed). */
  reason?: string;
  /** The Ready condition's human-readable message. */
  message?: string;
}

/**
 * Derives whether a Component is in a controller-error state from its
 * `status.conditions`, mirroring {@link deriveBindingStatusDetailed} for
 * ReleaseBindings.
 *
 * This is the *only* place pre-binding auto-deploy failures surface: when the
 * controller can't even create a ReleaseBinding (bad trait, invalid config,
 * missing workload), it marks the Component's Ready condition False with a
 * reason like `AutoDeployFailed` / `TraitNotFound` / `RenderingFailed` /
 * `InvalidConfiguration` / `WorkloadNotFound`
 * (internal/controller/component/controller.go).
 *
 * `Ready=True`, `Ready=Unknown`, an absent Ready condition, or a `Ready=False`
 * with a transient reason all map to `hasError: false`.
 */
export function deriveComponentReadiness(
  component: Component,
): ComponentReadiness {
  const conditions = (component.status?.conditions ?? []) as Array<{
    type: string;
    status: string;
    reason?: string;
    message?: string;
    observedGeneration?: number;
  }>;

  if (conditions.length === 0) return { hasError: false };

  const generation = (component as any).metadata?.generation as
    | number
    | undefined;

  // Only trust conditions observed for the current generation. Treat a missing
  // observedGeneration as a match so older controllers aren't silently dropped.
  const conditionsForGeneration = generation
    ? conditions.filter(
        c =>
          c.observedGeneration === undefined ||
          c.observedGeneration === generation,
      )
    : conditions;

  const readyCond = conditionsForGeneration.find(c => c.type === 'Ready');
  // No Ready condition yet → not yet reconciled, not an error.
  if (!readyCond || readyCond.status !== 'False') return { hasError: false };

  // Ready=False but still progressing → not a terminal error.
  if (
    PROGRESSING_REASONS.includes(
      readyCond.reason as (typeof PROGRESSING_REASONS)[number],
    )
  ) {
    return {
      hasError: false,
      reason: readyCond.reason,
      message: readyCond.message,
    };
  }

  return {
    hasError: true,
    reason: readyCond.reason,
    message: readyCond.message,
  };
}
