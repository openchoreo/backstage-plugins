import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';
import type {
  EndpointReleaseBindingResponse,
  ReleaseBindingCondition,
  ResolvedEndpointBackend,
} from '@openchoreo/backstage-plugin-common';
import { getName, getNamespace, getCreatedAt } from './common';
import { deriveBindingStatusDetailed } from './release-binding';

type NewEndpointReleaseBinding =
  OpenChoreoComponents['schemas']['EndpointReleaseBinding'];

/**
 * Maps an EndpointReleaseBinding's status.backends to the frontend shape.
 * Shared by the binding transformer and the per-environment join so both
 * report backend resolution identically.
 */
export function transformResolvedEndpointBackends(
  binding: NewEndpointReleaseBinding,
): ResolvedEndpointBackend[] | undefined {
  const raw = binding.status?.backends;
  if (!Array.isArray(raw)) return undefined;
  return raw.map(b => ({
    name: b.name,
    kind: b.kind,
    weight: b.weight,
    resolved: b.resolved,
    serviceURL: b.serviceURL
      ? {
          scheme: b.serviceURL.scheme,
          host: b.serviceURL.host,
          port: b.serviceURL.port,
          path: b.serviceURL.path,
        }
      : undefined,
    reason: b.reason,
    message: b.message,
  }));
}

/**
 * Transforms a K8s-style EndpointReleaseBinding into the flat
 * EndpointReleaseBindingResponse shape expected by the frontend. Reuses the
 * Ready-condition derivation of ReleaseBinding, whose condition vocabulary
 * the Endpoint binding shares.
 */
export function transformEndpointReleaseBinding(
  binding: NewEndpointReleaseBinding,
): EndpointReleaseBindingResponse {
  const derived = deriveBindingStatusDetailed(binding as any);

  return {
    name: getName(binding) ?? '',
    endpointName: binding.spec?.owner?.endpointName ?? '',
    projectName: binding.spec?.owner?.projectName ?? '',
    namespaceName: getNamespace(binding) ?? '',
    environment: binding.spec?.environment ?? '',
    releaseName: binding.spec?.endpointRelease ?? '',
    endpointTypeEnvironmentConfigs: binding.spec
      ?.endpointTypeEnvironmentConfigs as Record<string, unknown> | undefined,
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
    backends: transformResolvedEndpointBackends(binding),
  };
}
