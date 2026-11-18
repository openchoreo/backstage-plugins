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

/**
 * The annotation that keeps a (Cluster)ComponentType on legacy endpoints:
 * its components keep visibility on their workload endpoints (deprecated),
 * served by the type's own templated routes, and own no Endpoints. Platform
 * engineers add it to every ComponentType that predates Endpoints before
 * upgrading; types without it expose endpoints through Endpoints.
 */
export const LEGACY_ENDPOINTS_ANNOTATION = 'openchoreo.dev/legacy-endpoints';

/** Whether a (Cluster)ComponentType's annotations keep it on legacy endpoints. */
export function isLegacyEndpointsComponentType(
  annotations: Record<string, string> | undefined,
): boolean {
  return annotations?.[LEGACY_ENDPOINTS_ANNOTATION] === 'true';
}

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
 * A workload endpoint's visibilities beyond project: those it carried on the
 * workload before Endpoints, when project scope was implicit. Telling them
 * apart finds workload endpoints from before Endpoints.
 */
export function exposableVisibilities(endpoint: ExposableEndpoint): string[] {
  return (endpoint.visibility ?? []).filter(v => v !== 'project');
}

/**
 * The visibilities an Endpoint carries for a workload endpoint: every one
 * chosen for it, project included, each once.
 */
export function endpointVisibilities(endpoint: ExposableEndpoint): string[] {
  return [...new Set(endpoint.visibility ?? [])];
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

/** An Endpoint type the developer can pick, with the protocols it serves. */
export interface EndpointTypeOption {
  key: string;
  /** The entry the option is shown as: the default one, else the first. */
  entry: AllowedEndpointTypeEntry;
  /** Every protocol the allowed entries for this type serve. */
  protocols: string[];
}

/**
 * The Endpoint types a workload endpoint can be exposed through, default
 * entries first. Each EndpointType appears once, serving the protocols of
 * every entry that references it.
 */
export function endpointTypeOptions(
  entries: AllowedEndpointTypeEntry[],
): EndpointTypeOption[] {
  const ordered = [
    ...entries.filter(e => e.default),
    ...entries.filter(e => !e.default),
  ];
  const options = new Map<string, EndpointTypeOption>();
  for (const entry of ordered) {
    const key = endpointTypeKey(entry.ref);
    const option = options.get(key);
    if (option) {
      for (const protocol of entry.protocols) {
        if (!option.protocols.includes(protocol)) {
          option.protocols.push(protocol);
        }
      }
    } else {
      options.set(key, { key, entry, protocols: [...entry.protocols] });
    }
  }
  return [...options.values()];
}

/** The protocols an Endpoint type serves; none when it isn't allowed. */
export function endpointTypeProtocols(
  typeKey: string,
  entries: AllowedEndpointTypeEntry[],
): string[] {
  return (
    endpointTypeOptions(entries).find(o => o.key === typeKey)?.protocols ?? []
  );
}

/**
 * The protocol a workload endpoint takes when exposed through an Endpoint
 * type: its current protocol when the type serves it, otherwise HTTP when
 * the type serves that, otherwise the type's first protocol.
 */
export function protocolForEndpointType(
  current: string,
  typeKey: string,
  entries: AllowedEndpointTypeEntry[],
): string {
  const protocols = endpointTypeProtocols(typeKey, entries);
  if (protocols.length === 0 || protocols.includes(current)) return current;
  return protocols.includes('HTTP') ? 'HTTP' : protocols[0];
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
 * their visibilities beyond project, which the Endpoint carries instead, and
 * keep the project scope the saved workload gives them (the row's own, for
 * one not saved yet), since the Endpoint carries the visibility the page
 * shows. Every endpoint gets `protocol` set alongside the deprecated type.
 */
export function workloadEndpointsForSave<
  T extends { protocol?: string; type?: string; visibility?: string[] },
>(
  endpoints: Record<string, T>,
  exposedThroughEndpoint: Iterable<string>,
  saved: Record<string, { visibility?: string[] }> = {},
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
      const kept = ((saved[name] ?? endpoint).visibility ?? []).filter(
        v => v === 'project',
      );
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
