import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';
import type {
  ReleaseBindingResponse,
  ReleaseBindingEndpoint,
  ReleaseBindingCondition,
} from '@openchoreo/backstage-plugin-common';
import { getName, getNamespace, getCreatedAt } from './common';

type NewReleaseBinding = OpenChoreoComponents['schemas']['ReleaseBinding'];

/** Reasons on the Ready condition that indicate transient progress, not an error. */
const PROGRESSING_REASONS = [
  'ResourcesProgressing',
  'JobRunning',
  'ConnectionsPending',
  'ResourcesUnknown',
] as const;

/** Reasons that represent an intentional non-deployed state, not an error. */
const NON_ERROR_REASONS = ['ResourcesUndeployed'] as const;

export interface DerivedBindingStatus {
  status: 'Ready' | 'NotReady' | 'Failed';
  reason?: string;
  message?: string;
}

/**
 * Derives a binding status from the Ready condition on the ReleaseBinding.
 *
 * The Ready condition is now always present (fixed in openchoreo#2697) and is
 * the single source of truth. Its reason distinguishes transient progress
 * (→ NotReady) from actual errors (→ Failed).
 */
export function deriveBindingStatus(
  binding: NewReleaseBinding,
): 'Ready' | 'NotReady' | 'Failed' | undefined {
  return deriveBindingStatusDetailed(binding)?.status;
}

/**
 * Like deriveBindingStatus but also returns the Ready condition's reason and
 * message so callers can surface actionable details.
 */
export function deriveBindingStatusDetailed(
  binding: NewReleaseBinding,
): DerivedBindingStatus | undefined {
  const conditions = (binding.status?.conditions ?? []) as Array<{
    type: string;
    status: string;
    reason?: string;
    message?: string;
    observedGeneration?: number;
  }>;

  if (conditions.length === 0) return { status: 'NotReady' };

  const generation = (binding as any).metadata?.generation as
    | number
    | undefined;

  // Collect conditions for the current generation.
  // Treat missing observedGeneration as a match so older controllers don't
  // cause conditions to be silently dropped.
  const conditionsForGeneration = generation
    ? conditions.filter(
        c =>
          c.observedGeneration === undefined ||
          c.observedGeneration === generation,
      )
    : conditions;

  // Use the Ready condition as the single source of truth
  const readyCond = conditionsForGeneration.find(c => c.type === 'Ready');
  if (!readyCond) return { status: 'NotReady' }; // Not yet reconciled

  if (readyCond.status === 'True') {
    return {
      status: 'Ready',
      reason: readyCond.reason,
      message: readyCond.message,
    };
  }

  // Ready=False: distinguish progressing from errors
  if (
    PROGRESSING_REASONS.includes(
      readyCond.reason as (typeof PROGRESSING_REASONS)[number],
    )
  ) {
    return {
      status: 'NotReady',
      reason: readyCond.reason,
      message: readyCond.message,
    };
  }

  // Intentional undeploy — not an error
  if (
    NON_ERROR_REASONS.includes(
      readyCond.reason as (typeof NON_ERROR_REASONS)[number],
    )
  ) {
    return {
      status: 'NotReady',
      reason: readyCond.reason,
      message: readyCond.message,
    };
  }

  // Everything else is a failure
  return {
    status: 'Failed',
    reason: readyCond.reason,
    message: readyCond.message,
  };
}

/**
 * Transforms a K8s-style ReleaseBinding resource into the flat
 * ReleaseBindingResponse shape expected by the frontend.
 */
export function transformReleaseBinding(
  binding: NewReleaseBinding,
): ReleaseBindingResponse {
  const derived = deriveBindingStatusDetailed(binding);

  return {
    name: getName(binding) ?? '',
    componentName: binding.spec?.owner?.componentName ?? '',
    projectName: binding.spec?.owner?.projectName ?? '',
    namespaceName: getNamespace(binding) ?? '',
    environment: binding.spec?.environment ?? '',
    releaseName: binding.spec?.releaseName ?? '',
    componentTypeEnvironmentConfigs:
      binding.spec?.componentTypeEnvironmentConfigs,
    traitEnvironmentConfigs: binding.spec?.traitEnvironmentConfigs,
    workloadOverrides: binding.spec?.workloadOverrides as
      | ReleaseBindingResponse['workloadOverrides']
      | undefined,
    createdAt: getCreatedAt(binding) ?? '',
    lastSpecUpdateTime:
      (binding.status as any)?.lastSpecUpdateTime ?? undefined,
    status: derived?.status,
    statusReason: derived?.reason,
    statusMessage: derived?.message,
    endpoints: (() => {
      const raw = (binding.status as any)?.endpoints;
      if (!Array.isArray(raw)) return undefined;
      return raw.filter(
        (e): e is ReleaseBindingEndpoint =>
          e !== null && typeof e === 'object' && typeof e.name === 'string',
      );
    })(),
    conditions: (() => {
      const raw = binding.status?.conditions;
      if (!Array.isArray(raw)) return undefined;
      return raw.map(
        (c: any): ReleaseBindingCondition => ({
          type: c.type,
          status: c.status,
          reason: c.reason,
          message: c.message,
          lastTransitionTime: c.lastTransitionTime,
          observedGeneration: c.observedGeneration,
        }),
      );
    })(),
  };
}
