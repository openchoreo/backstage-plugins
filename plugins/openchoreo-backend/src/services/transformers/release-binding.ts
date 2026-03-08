import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';
import type {
  ReleaseBindingResponse,
  ReleaseBindingEndpoint,
} from '@openchoreo/backstage-plugin-common';
import { getName, getNamespace, getCreatedAt } from './common';

type NewReleaseBinding = OpenChoreoComponents['schemas']['ReleaseBinding'];

const EXPECTED_CONDITION_TYPES = [
  'ReleaseSynced',
  'ResourcesReady',
  'Ready',
] as const;

/**
 * Derives a binding status string from K8s conditions.
 *
 * Improvements over Go-side determineReleaseBindingStatus:
 *   1. Missing observedGeneration is treated as a match (included in filter)
 *   2. All three expected condition types must be present with status "True" for Ready
 *   3. Any False condition → Failed (if ResourcesDegraded) or NotReady (otherwise)
 */
export function deriveBindingStatus(
  binding: NewReleaseBinding,
): 'Ready' | 'NotReady' | 'Failed' | undefined {
  const conditions = (binding.status?.conditions ?? []) as Array<{
    type: string;
    status: string;
    reason?: string;
    observedGeneration?: number;
  }>;

  if (conditions.length === 0) return 'NotReady';

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

  // Need at least the 3 expected condition types for a conclusive status
  if (conditionsForGeneration.length < EXPECTED_CONDITION_TYPES.length) {
    return 'NotReady';
  }

  // Any condition with a failure reason → Failed
  const FAILURE_REASONS = ['ResourcesDegraded', 'ResourceApplyFailed'] as const;
  if (
    conditionsForGeneration.some(
      c =>
        c.status === 'False' &&
        FAILURE_REASONS.includes(c.reason as (typeof FAILURE_REASONS)[number]),
    )
  ) {
    return 'Failed';
  }

  // Any other False condition → NotReady (don't rely on a hardcoded reason allowlist)
  if (conditionsForGeneration.some(c => c.status === 'False')) {
    return 'NotReady';
  }

  // All three expected types must be present with status "True"
  const allExpectedTrue = EXPECTED_CONDITION_TYPES.every(type => {
    const cond = conditionsForGeneration.find(c => c.type === type);
    return cond?.status === 'True';
  });

  return allExpectedTrue ? 'Ready' : 'NotReady';
}

/**
 * Transforms a K8s-style ReleaseBinding resource into the flat
 * ReleaseBindingResponse shape expected by the frontend.
 */
export function transformReleaseBinding(
  binding: NewReleaseBinding,
): ReleaseBindingResponse {
  return {
    name: getName(binding) ?? '',
    componentName: binding.spec?.owner?.componentName ?? '',
    projectName: binding.spec?.owner?.projectName ?? '',
    namespaceName: getNamespace(binding) ?? '',
    environment: binding.spec?.environment ?? '',
    releaseName: binding.spec?.releaseName ?? '',
    componentTypeEnvOverrides: binding.spec?.componentTypeEnvOverrides,
    traitOverrides: binding.spec?.traitOverrides,
    workloadOverrides: binding.spec?.workloadOverrides as
      | ReleaseBindingResponse['workloadOverrides']
      | undefined,
    createdAt: getCreatedAt(binding) ?? '',
    lastSpecUpdateTime:
      (binding.status as any)?.lastSpecUpdateTime ?? undefined,
    status: deriveBindingStatus(binding),
    endpoints: (() => {
      const raw = (binding.status as any)?.endpoints;
      if (!Array.isArray(raw)) return undefined;
      return raw.filter(
        (e): e is ReleaseBindingEndpoint =>
          e !== null && typeof e === 'object' && typeof e.name === 'string',
      );
    })(),
  };
}
