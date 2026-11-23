import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';
import type { EndpointInfo, Environment } from '../../types';
import { isLineBackend } from '../EndpointService/componentEndpoints';
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

/** The line of a component whose deploy page is shown. */
export interface DeployPageLine {
  componentName: string;
  /** Omitted or '' for the main line. */
  releaseLine?: string;
}

/**
 * The workload endpoints an Endpoint routes to on this line of the
 * component. Its backends on other lines, as a canary's, belong to those
 * lines' deploy pages.
 */
function workloadEndpointsOf(
  endpoint: Endpoint,
  line: DeployPageLine,
): string[] {
  const names = (endpoint.spec?.backendRefs ?? [])
    .filter(ref => isLineBackend(ref, line.componentName, line.releaseLine))
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
 * keeps the ReleaseBinding's URLs. Only backends on the page's line count,
 * and when two Endpoints deployed in an environment expose the same workload
 * endpoint, the first one listed shows there, as the configure page manages
 * the first one.
 *
 * Returns new environment objects; the input isn't changed.
 */
export function applyComponentEndpointUrls(
  environments: Environment[],
  componentEndpoints: ComponentEndpointBindings[],
  line: DeployPageLine,
): Environment[] {
  if (componentEndpoints.length === 0) return environments;

  return environments.map(env => {
    const envName = (env.resourceName ?? env.name).toLowerCase();
    const entries = new Map<string, EndpointInfo>(
      env.endpoints.map(ep => [ep.name, { ...ep }]),
    );
    let changed = false;
    // Workload endpoints an Endpoint has already shown in this environment.
    const shown = new Set<string>();

    for (const { endpoint, bindings } of componentEndpoints) {
      const binding = bindings.find(
        b => b.spec?.environment?.toLowerCase() === envName,
      );
      const urls = binding?.status?.urls;
      if (!urls) continue;

      for (const workloadEndpoint of workloadEndpointsOf(endpoint, line)) {
        if (shown.has(workloadEndpoint)) continue;
        shown.add(workloadEndpoint);
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
