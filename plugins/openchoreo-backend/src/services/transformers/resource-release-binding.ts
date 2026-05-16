import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';
import type {
  ResourceReleaseBindingResponse,
  ReleaseBindingCondition,
  ResolvedResourceOutput,
} from '@openchoreo/backstage-plugin-common';
import { getName, getNamespace, getCreatedAt } from './common';
import { deriveBindingStatusDetailed } from './release-binding';

type NewResourceReleaseBinding =
  OpenChoreoComponents['schemas']['ResourceReleaseBinding'];

/**
 * Transforms a K8s-style ResourceReleaseBinding into the flat
 * ResourceReleaseBindingResponse shape expected by the frontend. Reuses
 * the same Ready-condition derivation as ReleaseBinding because both
 * carry an aggregate Ready condition with identical vocabulary.
 */
export function transformResourceReleaseBinding(
  binding: NewResourceReleaseBinding,
): ResourceReleaseBindingResponse {
  const derived = deriveBindingStatusDetailed(binding as any);

  return {
    name: getName(binding) ?? '',
    resourceName: binding.spec?.owner?.resourceName ?? '',
    projectName: binding.spec?.owner?.projectName ?? '',
    namespaceName: getNamespace(binding) ?? '',
    environment: binding.spec?.environment ?? '',
    releaseName: binding.spec?.resourceRelease ?? '',
    retainPolicy: binding.spec?.retainPolicy,
    resourceTypeEnvironmentConfigs:
      binding.spec?.resourceTypeEnvironmentConfigs as
        | Record<string, unknown>
        | undefined,
    createdAt: getCreatedAt(binding) ?? '',
    status: derived?.status,
    statusReason: derived?.reason,
    statusMessage: derived?.message,
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
    outputs: (() => {
      const raw = binding.status?.outputs;
      if (!Array.isArray(raw)) return undefined;
      return raw.map(
        (o: any): ResolvedResourceOutput => ({
          name: o.name,
          value: o.value,
          secretKeyRef: o.secretKeyRef
            ? { name: o.secretKeyRef.name, key: o.secretKeyRef.key }
            : undefined,
          configMapKeyRef: o.configMapKeyRef
            ? { name: o.configMapKeyRef.name, key: o.configMapKeyRef.key }
            : undefined,
        }),
      );
    })(),
  };
}
