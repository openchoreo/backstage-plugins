import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';
import type { ReleaseBindingResponse } from '@openchoreo/backstage-plugin-common';
import { getName, getNamespace, getCreatedAt } from './common';

type NewReleaseBinding = OpenChoreoComponents['schemas']['ReleaseBinding'];

/**
 * Derives a binding status string from K8s conditions.
 * Matches the Go-side determineReleaseBindingStatus logic:
 *   1. No conditions → NotReady
 *   2. < 3 conditions for current generation → NotReady
 *   3. Any condition False with reason ResourcesDegraded → Failed
 *   4. Any condition False with reason ResourcesProgressing → NotReady
 *   5. All conditions present and none degraded → Ready
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

  const generation = (binding as any).metadata?.generation;

  // Collect conditions for the current generation
  const conditionsForGeneration = generation
    ? conditions.filter(c => c.observedGeneration === generation)
    : conditions;

  // Expected conditions: ReleaseSynced, ResourcesReady, Ready
  if (conditionsForGeneration.length < 3) return 'NotReady';

  // Check for ResourcesDegraded → Failed
  if (
    conditionsForGeneration.some(
      c => c.status === 'False' && c.reason === 'ResourcesDegraded',
    )
  ) {
    return 'Failed';
  }

  // Check for ResourcesProgressing → NotReady
  if (
    conditionsForGeneration.some(
      c => c.status === 'False' && c.reason === 'ResourcesProgressing',
    )
  ) {
    return 'NotReady';
  }

  return 'Ready';
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
    status: deriveBindingStatus(binding),
    endpoints: (binding.status as any)?.endpoints?.map(
      (ep: { name?: string; url?: string }) => ({
        name: ep.name ?? '',
        url: ep.url ?? '',
      }),
    ),
  };
}
