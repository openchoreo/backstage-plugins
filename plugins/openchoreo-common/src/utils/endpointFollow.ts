/**
 * The rules a client follows to take a component's Endpoints with it when it
 * deploys, promotes, redeploys or undeploys the component (openchoreo #4997,
 * "deploy and promote a component's Endpoints with the component"). occ and
 * MCP implement the same rules in Go.
 *
 * Only the Endpoints the deployed line of the component owns follow it:
 * `spec.owner.componentName` is the component and `spec.owner.releaseLineName`
 * the line (unset for the main line). Project-owned Endpoints never do.
 */

/** What happened to the component that its Endpoints follow. */
export type EndpointFollowAction =
  /** Deployed to the pipeline's first environment. */
  | 'deploy'
  /** Promoted from a source environment to the target. */
  | 'promote'
  /** Deployed again where it was undeployed. */
  | 'redeploy';

/** One owned Endpoint, as the rules need it. */
export interface FollowingEndpoint {
  name: string;
  /** `spec.autoDeploy`: the controller keeps it on the latest release in the first environment. */
  autoDeploy: boolean;
  /** `status.latestRelease.name`, once the controller has cut one. */
  latestRelease?: string;
  /** The EndpointRelease its binding in the source environment pins, on a promote. */
  sourceRelease?: string;
}

/** What to do with one owned Endpoint. */
export type EndpointFollowStep =
  | { endpoint: string; kind: 'bind'; releaseName: string }
  | { endpoint: string; kind: 'skip'; reason: 'autoDeploy' }
  | { endpoint: string; kind: 'unreleased' };

/**
 * Decides how each owned Endpoint follows the component:
 * - deploy: bind its latest release, except an auto-deploying Endpoint,
 *   which the controller binds and keeps current (binding it here would
 *   race the controller);
 * - promote: bind the release its binding in the source environment pins,
 *   so the same Endpoint version moves with the component, or its latest
 *   release without one; auto deploy covers only the first environment, so
 *   every Endpoint is bound;
 * - redeploy: bind its latest release.
 * An Endpoint without a release to bind is reported unreleased.
 */
export function planEndpointFollow(
  action: EndpointFollowAction,
  endpoints: FollowingEndpoint[],
): EndpointFollowStep[] {
  return endpoints.map(endpoint => {
    if (action === 'deploy' && endpoint.autoDeploy) {
      return { endpoint: endpoint.name, kind: 'skip', reason: 'autoDeploy' };
    }
    const releaseName =
      action === 'promote'
        ? endpoint.sourceRelease ?? endpoint.latestRelease
        : endpoint.latestRelease;
    return releaseName
      ? { endpoint: endpoint.name, kind: 'bind', releaseName }
      : { endpoint: endpoint.name, kind: 'unreleased' };
  });
}

/**
 * How a component's Endpoints followed it, for the client to report. An
 * Endpoint that didn't follow leaves the component as it is: the action
 * can simply be repeated.
 */
export interface EndpointFollowResult {
  /** Endpoints bound to the environment, with the release each pins. */
  bound: { endpoint: string; releaseName: string }[];
  /** Endpoints whose binding in the environment was deleted. */
  removed: string[];
  /** Endpoints left to the controller (auto deploy, on a deploy). */
  skipped: string[];
  /** Endpoints that didn't follow, and why. */
  failed: { endpoint: string; reason: string }[];
}

/** A result with nothing in it, for a component that owns no Endpoints. */
export function emptyEndpointFollowResult(): EndpointFollowResult {
  return { bound: [], removed: [], skipped: [], failed: [] };
}
