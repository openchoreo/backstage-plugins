import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';
import type {
  EndpointInvokeURLs,
  EndpointURLDetails,
  EndpointURLSecurity,
} from '../../types';

type ResolvedEndpointURL =
  OpenChoreoComponents['schemas']['ResolvedEndpointURL'];
type EndpointReleaseBindingURLs =
  OpenChoreoComponents['schemas']['EndpointReleaseBindingURLs'];

const VISIBILITIES = ['external', 'internal', 'namespace', 'project'] as const;

/** One URL an Endpoint resolved, as the portal shows URLs. */
export function toEndpointURLDetails(
  url: ResolvedEndpointURL,
): EndpointURLDetails {
  const security: EndpointURLSecurity | undefined = url.security
    ? {
        scheme: url.security.scheme,
        ...(url.security.apiKey && {
          apiKey: {
            in: url.security.apiKey.in,
            name: url.security.apiKey.name,
          },
        }),
      }
    : undefined;
  return {
    scheme: url.scheme ?? '',
    host: url.host,
    port: url.port ?? 0,
    ...(url.path && { path: url.path }),
    ...(security && { security }),
  };
}

/**
 * The URLs an EndpointReleaseBinding resolved, per visibility. Undefined
 * until the binding has resolved any.
 */
export function toEndpointInvokeURLs(
  urls: EndpointReleaseBindingURLs | undefined,
): EndpointInvokeURLs | undefined {
  if (!urls) return undefined;
  const entries = VISIBILITIES.flatMap(visibility => {
    const url = urls[visibility];
    return url ? [[visibility, toEndpointURLDetails(url)] as const] : [];
  });
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}
