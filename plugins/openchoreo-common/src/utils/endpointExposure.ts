/**
 * Choosing how a component's workload endpoints are exposed through
 * Endpoints, from its ComponentType's `allowedEndpoints`.
 *
 * Used by the configure page, the only place a component's Endpoints are
 * defined. In its Endpoints form, a workload endpoint with a visibility
 * beyond project is exposed through an Endpoint of an allowed EndpointType,
 * which carries those visibilities; they are dropped from the workload. In
 * its legacy form they stay on the workload, in the deprecated field
 * ComponentType templates still read.
 */
/** An `allowedEndpoints` entry of a (Cluster)ComponentType. */
export interface AllowedEndpointTypeEntry {
  name?: string;
  protocols: string[];
  ref: { kind?: string; name: string };
  default?: boolean;
}

export type EndpointTypeKind = 'EndpointType' | 'ClusterEndpointType';

/** The part of a workload endpoint that decides how it can be exposed. */
export interface ExposableEndpoint {
  protocol?: string;
  type?: string;
  visibility?: string[];
}

/** The EndpointType key of a protocol no allowed EndpointType serves. */
export const NO_ENDPOINT = 'none';

/**
 * What the developer chose for one workload endpoint: an EndpointType key
 * and the parameters for that type.
 */
export interface EndpointExposureChoice {
  type: string;
  parameters?: Record<string, unknown>;
}

/** Choices keyed by workload endpoint name. */
export type EndpointExposures = Record<string, EndpointExposureChoice>;

/** A workload endpoint's protocol, falling back to the deprecated type. */
export function endpointProtocol(endpoint: ExposableEndpoint): string {
  return endpoint.protocol || endpoint.type || '';
}

/** Identifies the EndpointType an entry references. */
export function endpointTypeKey(ref: { kind?: string; name: string }): string {
  return `${ref.kind || 'EndpointType'}/${ref.name}`;
}

/** Splits an EndpointType key back into kind and name. */
export function parseEndpointTypeKey(key: string): {
  kind: EndpointTypeKind;
  name: string;
} {
  const slash = key.indexOf('/');
  return {
    kind: key.slice(0, slash) as EndpointTypeKind,
    name: key.slice(slash + 1),
  };
}

/**
 * The visibilities of a workload endpoint that an Endpoint can expose.
 * Project scope is implicit for every workload endpoint and never routed.
 */
export function exposableVisibilities(endpoint: ExposableEndpoint): string[] {
  return (endpoint.visibility ?? []).filter(v => v !== 'project');
}

/**
 * The entries that may expose a workload endpoint of this protocol, default
 * entries first. Each EndpointType appears once.
 */
export function endpointTypeCandidates(
  protocol: string,
  entries: AllowedEndpointTypeEntry[],
): AllowedEndpointTypeEntry[] {
  const matching = entries.filter(e => e.protocols.includes(protocol));
  const ordered = [
    ...matching.filter(e => e.default),
    ...matching.filter(e => !e.default),
  ];
  const seen = new Set<string>();
  return ordered.filter(e => {
    const key = endpointTypeKey(e.ref);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * The EndpointType key a protocol starts with: its default entry, otherwise
 * the first allowed one, or {@link NO_ENDPOINT} when none is allowed.
 */
export function defaultEndpointType(
  protocol: string,
  entries: AllowedEndpointTypeEntry[],
): string {
  const [first] = endpointTypeCandidates(protocol, entries);
  return first ? endpointTypeKey(first.ref) : NO_ENDPOINT;
}

/**
 * The EndpointType a workload endpoint is exposed through: the developer's
 * choice when it is still a candidate for the protocol, otherwise the
 * protocol's default ({@link NO_ENDPOINT} when no type serves it).
 */
export function resolveEndpointType(
  endpoint: ExposableEndpoint,
  entries: AllowedEndpointTypeEntry[],
  choice?: EndpointExposureChoice,
): string {
  const protocol = endpointProtocol(endpoint);
  const chosen = choice?.type;
  if (
    chosen &&
    endpointTypeCandidates(protocol, entries).some(
      c => endpointTypeKey(c.ref) === chosen,
    )
  ) {
    return chosen;
  }
  return defaultEndpointType(protocol, entries);
}

/**
 * The workload endpoints to save: those exposed through an Endpoint lose
 * their visibilities beyond project, which the Endpoint carries instead.
 * Every endpoint gets `protocol` set alongside the deprecated type.
 */
export function workloadEndpointsForSave<
  T extends { protocol?: string; type?: string; visibility?: string[] },
>(
  endpoints: Record<string, T>,
  exposedThroughEndpoint: Iterable<string>,
): Record<string, T> {
  const exposed = new Set(exposedThroughEndpoint);
  const result: Record<string, T> = {};
  for (const [name, endpoint] of Object.entries(endpoints)) {
    const protocol = endpointProtocol(endpoint);
    const next: T = {
      ...endpoint,
      ...(protocol && { protocol, type: protocol }),
    };
    if (exposed.has(name)) {
      const kept = (endpoint.visibility ?? []).filter(v => v === 'project');
      if (kept.length > 0) {
        next.visibility = kept;
      } else {
        delete next.visibility;
      }
    }
    result[name] = next;
  }
  return result;
}
