import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';
import type { ResolvedEndpointBackend } from '@openchoreo/backstage-plugin-common';

type NewEndpointReleaseBinding =
  OpenChoreoComponents['schemas']['EndpointReleaseBinding'];

/**
 * Maps an EndpointReleaseBinding's status.backends to the frontend shape.
 * Used by the per-environment join.
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
