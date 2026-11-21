/**
 * Building the Endpoint created for one workload endpoint of a component, or
 * of one of its release lines, from the component's or the line's configure
 * page. The component, and the line, own the Endpoint through its
 * `spec.owner`, so deleting either deletes the Endpoint.
 */
import { deriveEndpointBackendName } from './endpointBackends';
import type { EndpointTypeKind } from './endpointExposure';

const MAX_NAME_LENGTH = 63;

/** FNV-1a over the UTF-16 code units, as 8 hex digits. */
function shortHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Turns an arbitrary string into a DNS-1123 label, keeping it unique when it
 * has to be shortened by replacing the tail with a hash of the full value.
 */
export function toDnsLabel(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (cleaned.length <= MAX_NAME_LENGTH) {
    return cleaned;
  }
  const hash = shortHash(value);
  const head = cleaned
    .slice(0, MAX_NAME_LENGTH - hash.length - 1)
    .replace(/-$/, '');
  return `${head}-${hash}`;
}

/**
 * Name of the Endpoint for a component's workload endpoint:
 * `<component>-<endpoint>` for its main line, `<component>-<line>-<endpoint>`
 * for one of its release lines, suffixed with the EndpointType when the
 * workload endpoint is exposed through more than one type. A line's Endpoint
 * is named apart from main's, so the two never collide as resources.
 */
export function componentEndpointName(
  componentName: string,
  workloadEndpoint: string,
  typeName?: string,
  releaseLine?: string,
): string {
  const base = releaseLine
    ? `${componentName}-${releaseLine}-${workloadEndpoint}`
    : `${componentName}-${workloadEndpoint}`;
  return toDnsLabel(typeName ? `${base}-${typeName}` : base);
}

/**
 * One of a component's own Endpoints as the backend hands it to the
 * component's configure page.
 */
export interface ComponentEndpointSummary {
  name: string;
  /**
   * The release line the Endpoint was created for, or '' for the component's
   * main line. Absent when the summary predates release lines.
   */
  releaseLine?: string;
  /** The workload endpoint of the component the Endpoint routes to. */
  workloadEndpoint: string;
  typeKind: EndpointTypeKind;
  typeName: string;
  visibility: string[];
  parameters: Record<string, unknown>;
  autoDeploy: boolean;
  /** The Endpoint's Ready condition, once the controller has set it. */
  ready?: { status: string; reason?: string; message?: string };
  latestRelease?: string;
}

/** What an Endpoint for a component's workload endpoint is made from. */
export interface ComponentEndpointInput {
  name: string;
  componentName: string;
  projectName: string;
  /** The component's release line to route to; omitted for its main line. */
  releaseLine?: string;
  workloadEndpoint: string;
  typeKind: EndpointTypeKind;
  typeName: string;
  visibility: string[];
  parameters?: Record<string, unknown>;
  autoDeploy: boolean;
}

/**
 * The Endpoint resource for a component's workload endpoint. The component
 * owns it, and so does the release line it's created for, if any; its one
 * backend routes to that line. When a later change routes a backend outside
 * the owner, the API widens the owner to cover it.
 */
export function buildComponentEndpoint(input: ComponentEndpointInput) {
  const line = input.releaseLine;
  return {
    metadata: { name: input.name },
    spec: {
      owner: {
        projectName: input.projectName,
        componentName: input.componentName,
        ...(line ? { releaseLineName: line } : {}),
      },
      type: { kind: input.typeKind, name: input.typeName },
      visibility: input.visibility,
      backendRefs: [
        {
          name: deriveEndpointBackendName(
            input.componentName,
            input.workloadEndpoint,
            [],
            line,
          ),
          kind: 'Component' as const,
          component: {
            name: input.componentName,
            endpoint: input.workloadEndpoint,
            ...(line ? { releaseLine: line } : {}),
          },
        },
      ],
      ...(input.parameters &&
        Object.keys(input.parameters).length > 0 && {
          parameters: input.parameters,
        }),
      autoDeploy: input.autoDeploy,
    },
  };
}

/** The release line a set of main-line Endpoints is copied to. */
export interface ReleaseLineEndpointTarget {
  componentName: string;
  projectName: string;
  releaseLine: string;
  /** The line's effective autoDeploy, which its Endpoints follow. */
  autoDeploy: boolean;
}

/**
 * The generator for a release line's Endpoints: one Endpoint per Endpoint the
 * component has on its main line, copied for the line. Each copy keeps the
 * EndpointType, visibility and parameters, routes to the line, and is named
 * and labeled for it; a main Endpoint named with its EndpointType keeps that
 * suffix.
 *
 * Parameters are copied as they are, without assuming how the EndpointType
 * tells the copies apart: one type gives each Endpoint its own hostname,
 * another serves them on one host under different paths. The inputs are
 * drafts, so a client lets the user adjust parameters such as a path prefix
 * before creating them.
 *
 * Endpoints of other lines are skipped, so the summaries of a component's
 * Endpoints can be passed as they are. Names are deterministic, so running
 * the generator again yields the same Endpoints.
 */
export function releaseLineEndpointInputs(
  mainEndpoints: ComponentEndpointSummary[],
  target: ReleaseLineEndpointTarget,
): ComponentEndpointInput[] {
  return mainEndpoints
    .filter(ep => !ep.releaseLine)
    .map(ep => {
      const typed =
        ep.name ===
        componentEndpointName(
          target.componentName,
          ep.workloadEndpoint,
          ep.typeName,
        );
      return {
        name: componentEndpointName(
          target.componentName,
          ep.workloadEndpoint,
          typed ? ep.typeName : undefined,
          target.releaseLine,
        ),
        componentName: target.componentName,
        projectName: target.projectName,
        releaseLine: target.releaseLine,
        workloadEndpoint: ep.workloadEndpoint,
        typeKind: ep.typeKind,
        typeName: ep.typeName,
        visibility: [...ep.visibility],
        parameters: { ...ep.parameters },
        autoDeploy: target.autoDeploy,
      };
    });
}
