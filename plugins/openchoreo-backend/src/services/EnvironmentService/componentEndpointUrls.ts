import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';
import type { EndpointInfo, Environment } from '../../types';
import { toEndpointURLDetails } from './endpointUrls';

type Endpoint = OpenChoreoComponents['schemas']['Endpoint'];
type EndpointReleaseBinding =
  OpenChoreoComponents['schemas']['EndpointReleaseBinding'];
type ResolvedEndpointURL =
  OpenChoreoComponents['schemas']['ResolvedEndpointURL'];

/** One of a component's own Endpoints, with its bindings. */
export interface ComponentEndpointBindings {
  endpoint: Endpoint;
  bindings: EndpointReleaseBinding[];
}

/** Keys a URL the way the ReleaseBinding URL maps are keyed: by scheme. */
function byScheme(url: ResolvedEndpointURL | undefined) {
  if (!url) return undefined;
  const details = toEndpointURLDetails(url);
  return { [details.scheme || 'url']: details };
}

/** The workload endpoints of the component an Endpoint routes to. */
function workloadEndpointsOf(endpoint: Endpoint): string[] {
  const names = (endpoint.spec?.backendRefs ?? [])
    .map(ref => ref.component?.endpoint)
    .filter((name): name is string => !!name);
  return [...new Set(names)];
}

/**
 * Puts the URLs of a component's own Endpoints over the per-environment
 * endpoint list its deploy page shows.
 *
 * The list starts from the component's ReleaseBinding status: that's where
 * its URLs come from when it has no Endpoints, as a component of a legacy
 * ComponentType never does. A workload endpoint that one of its Endpoints
 * exposes, in an environment that Endpoint is deployed to, takes its URLs
 * from the Endpoint's binding instead: the external, internal, namespace and
 * project URLs it resolved, each with the security a caller must present, and
 * the Endpoint's name, which tells the two sources apart. The in-cluster
 * service URL stays, for an Endpoint that doesn't carry project visibility.
 * Everything else, including environments the Endpoint isn't deployed to,
 * keeps the ReleaseBinding's URLs.
 *
 * Returns new environment objects; the input isn't changed.
 */
export function applyComponentEndpointUrls(
  environments: Environment[],
  componentEndpoints: ComponentEndpointBindings[],
): Environment[] {
  if (componentEndpoints.length === 0) return environments;

  return environments.map(env => {
    const envName = (env.resourceName ?? env.name).toLowerCase();
    const entries = new Map<string, EndpointInfo>(
      env.endpoints.map(ep => [ep.name, { ...ep }]),
    );
    let changed = false;

    for (const { endpoint, bindings } of componentEndpoints) {
      const binding = bindings.find(
        b => b.spec?.environment?.toLowerCase() === envName,
      );
      const urls = binding?.status?.urls;
      if (!urls) continue;

      for (const workloadEndpoint of workloadEndpointsOf(endpoint)) {
        const entry: EndpointInfo = entries.get(workloadEndpoint) ?? {
          name: workloadEndpoint,
        };
        delete entry.externalURLs;
        delete entry.internalURLs;
        delete entry.namespaceURLs;
        delete entry.projectURL;

        const external = byScheme(urls.external);
        const internal = byScheme(urls.internal);
        const namespace = byScheme(urls.namespace);
        if (external) entry.externalURLs = external;
        if (internal) entry.internalURLs = internal;
        if (namespace) entry.namespaceURLs = namespace;
        if (urls.project) entry.projectURL = toEndpointURLDetails(urls.project);
        entry.endpointName = endpoint.metadata.name;

        entries.set(workloadEndpoint, entry);
        changed = true;
      }
    }

    return changed ? { ...env, endpoints: [...entries.values()] } : env;
  });
}
