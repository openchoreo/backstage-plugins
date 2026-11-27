/**
 * BFF wire types for an Endpoint's traffic: how each backend gets requests,
 * the Endpoint's default split and each environment's own split. Shared by
 * openchoreo-backend and the openchoreo frontend plugin.
 */

/** A header condition of a backend's match. */
export interface EndpointHeaderMatch {
  name: string;
  type?: 'Exact' | 'RegularExpression';
  value: string;
}

/** An exact cookie condition of a backend's match. */
export interface EndpointCookieMatch {
  name: string;
  value: string;
}

/**
 * The conditions a request must all meet to reach a backend before the
 * split. The path is relative to where the Endpoint is served.
 */
export interface EndpointBackendMatch {
  path?: { type?: 'PathPrefix' | 'Exact'; value: string };
  headers?: EndpointHeaderMatch[];
  /** At most one cookie. */
  cookies?: EndpointCookieMatch[];
}

/** A routing feature an EndpointType declares it can render. */
export type EndpointCapability =
  | 'Match'
  | 'RegularExpression'
  | 'Mirror'
  | 'MirrorPercent';

/**
 * How a backend gets requests: a share of the requests no condition takes,
 * every request that meets a condition (it can also have a share), or a
 * copy of a share of requests.
 */
export type BackendTraffic =
  | { kind: 'weight' }
  | { kind: 'match'; match: EndpointBackendMatch }
  | { kind: 'mirror'; percent: number };

/** One backend of an Endpoint or of a release. */
export interface EndpointTrafficBackend {
  /** The backend's name in the Endpoint (backendRefs[].name). */
  name: string;
  componentName: string;
  endpoint: string;
  /** Release line of the component; absent for its main line. */
  releaseLine?: string;
  /** Relative share of the requests no condition takes; 0 for a mirror. */
  weight: number;
  match?: EndpointBackendMatch;
  /** A mirror's copy share, 0 to 100. */
  mirror?: { percent: number };
}

/**
 * One backendOverrides entry: a weight, the environment's own condition for
 * a backend that has one in the release, or a mirror's copy share.
 */
export interface EndpointTrafficOverride {
  name: string;
  weight?: number;
  match?: EndpointBackendMatch;
  mirror?: { percent: number };
}

/** What an environment's binding pins and sets. */
export interface EndpointTrafficEnvironment {
  /** Environment name. */
  environment: string;
  bindingName: string;
  endpointRelease?: string;
  /** The pinned release's backends, as the release froze them. */
  release: EndpointTrafficBackend[];
  /** Set when the pinned release couldn't be read, so `release` is unknown, not empty. */
  releaseUnknown?: boolean;
  /** The environment's own traffic: only overrides naming a release backend. */
  overrides: EndpointTrafficOverride[];
  /**
   * What the type of the release it runs can render, from the release's
   * snapshot; undefined when the type declares nothing.
   */
  capabilities?: EndpointCapability[];
}

/** An Endpoint's backends, the routing its type renders and each environment. */
export interface EndpointTrafficInfo {
  /** The Endpoint's backends: the default split. */
  backends: EndpointTrafficBackend[];
  /** Undefined when the EndpointType declares nothing. */
  capabilities?: EndpointCapability[];
  environments: EndpointTrafficEnvironment[];
}

/** Percentages by backend name; a mirror's value is its copy share. */
export type EndpointSplit = Record<string, number>;

interface EndpointRef {
  namespaceName: string;
  endpointName: string;
}

/** Add a backend, or change one when `editing` names it. */
export interface SaveEndpointBackendRequest extends EndpointRef {
  componentName: string;
  endpoint: string;
  releaseLine?: string;
  /** The backend's name; derived from the component when absent. */
  name?: string;
  traffic: BackendTraffic;
  editing?: string;
  /**
   * The default split after the change, for the backends that take a share,
   * saved in the same update.
   */
  split?: EndpointSplit;
}

/** Remove a backend, which cuts a release. */
export interface RemoveEndpointBackendRequest extends EndpointRef {
  backendName: string;
}

/** Save the Endpoint's default split, which cuts a release. */
export interface SetEndpointSplitRequest extends EndpointRef {
  split: EndpointSplit;
}

/**
 * Save an environment's own traffic: its shares and copies, and its own
 * condition for backends that have one in the release. In `matches`, a
 * backend left out keeps the condition the environment has now, its own or
 * the release's; giving the release's condition drops the environment's
 * own. `split: null` drops all of the environment's own traffic, conditions
 * included.
 */
export interface SetEnvironmentSplitRequest extends EndpointRef {
  environment: string;
  split: EndpointSplit | null;
  matches?: Record<string, EndpointBackendMatch>;
}

/** Pin a release in an environment, keeping its own split where it still applies. */
export interface DeployEndpointReleaseRequest extends EndpointRef {
  projectName: string;
  environment: string;
  releaseName: string;
}

/** What a change to the Endpoint cut. */
export interface EndpointTrafficResult {
  latestRelease?: string;
}
