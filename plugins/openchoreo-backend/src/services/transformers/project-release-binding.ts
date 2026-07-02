import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';
import type {
  ProjectReleaseBindingResponse,
  ReleaseBindingCondition,
} from '@openchoreo/backstage-plugin-common';
import { getName, getNamespace, getCreatedAt } from './common';
import { deriveBindingStatusDetailed } from './release-binding';

type NewProjectReleaseBinding =
  OpenChoreoComponents['schemas']['ProjectReleaseBinding'];

/**
 * Transforms a K8s-style ProjectReleaseBinding into the flat
 * ProjectReleaseBindingResponse shape expected by the frontend. Reuses the
 * same Ready-condition derivation as the other bindings because the project
 * binding carries an aggregate Ready condition with identical vocabulary
 * (Synced / NamespaceReady / ResourcesReady / Ready).
 */
export function transformProjectReleaseBinding(
  binding: NewProjectReleaseBinding,
): ProjectReleaseBindingResponse {
  const derived = deriveBindingStatusDetailed(binding as any);

  return {
    name: getName(binding) ?? '',
    projectName: binding.spec?.owner?.projectName ?? '',
    namespaceName: getNamespace(binding) ?? '',
    environment: binding.spec?.environment ?? '',
    releaseName: binding.spec?.projectRelease ?? '',
    environmentConfigs: binding.spec?.environmentConfigs as
      | Record<string, unknown>
      | undefined,
    namespace: binding.status?.namespace,
    createdAt: getCreatedAt(binding) ?? '',
    status: derived?.status,
    statusReason: derived?.reason,
    statusMessage: derived?.message,
    conditions: (() => {
      const raw = binding.status?.conditions;
      if (!Array.isArray(raw)) return undefined;
      return raw.map(
        (c: any): ReleaseBindingCondition => ({
          // `type` and `status` are required on ReleaseBindingCondition;
          // default them since the source is untyped and a malformed
          // condition could otherwise leave required fields undefined.
          type: c.type ?? '',
          status: c.status ?? '',
          reason: c.reason,
          message: c.message,
          lastTransitionTime: c.lastTransitionTime,
          observedGeneration: c.observedGeneration,
        }),
      );
    })(),
  };
}
