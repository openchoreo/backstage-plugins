import { Entity } from '@backstage/catalog-model';
import {
  getAnnotation,
  type OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { WorkloadDependency, WorkloadEndpoint } from './types';

type NewProject = OpenChoreoComponents['schemas']['Project'];
type NewComponent = OpenChoreoComponents['schemas']['Component'];
type NewWorkload = OpenChoreoComponents['schemas']['Workload'];

// ────────────────────────────────────────────────────────────────────────
// Ownership resolution
// ────────────────────────────────────────────────────────────────────────

/**
 * Resolves the owner for a Project (System) entity from the
 * `backstage.io/owner` annotation, falling back to `defaultOwner`.
 */
export function resolveProjectOwner(
  project: NewProject,
  defaultOwner: string,
): string {
  return (
    getAnnotation(project, CHOREO_ANNOTATIONS.BACKSTAGE_OWNER)?.trim() ||
    defaultOwner
  );
}

/**
 * Resolves the owner for a Component entity.
 * Priority: component annotation > project annotation > defaultOwner.
 */
export function resolveComponentOwner(
  component: NewComponent,
  project: NewProject | undefined,
  defaultOwner: string,
): string {
  const componentOwn = getAnnotation(
    component,
    CHOREO_ANNOTATIONS.BACKSTAGE_OWNER,
  )?.trim();
  if (componentOwn) return componentOwn;
  if (project) {
    const projectOwn = getAnnotation(
      project,
      CHOREO_ANNOTATIONS.BACKSTAGE_OWNER,
    )?.trim();
    if (projectOwn) return projectOwn;
  }
  return defaultOwner;
}

// ────────────────────────────────────────────────────────────────────────
// Workload extraction
// ────────────────────────────────────────────────────────────────────────

/**
 * Extracts all workload endpoints from a Workload resource.
 */
export function extractAllWorkloadEndpoints(
  workload: NewWorkload,
): Record<string, WorkloadEndpoint> {
  const spec = workload.spec as
    | { endpoints?: Record<string, WorkloadEndpoint> }
    | undefined;
  return spec?.endpoints || {};
}

/**
 * Filters endpoints to only those with schema content attached.
 * These are the endpoints that should produce Backstage API entities.
 */
export function extractSchemaEndpoints(
  allEndpoints: Record<string, WorkloadEndpoint>,
): Record<string, WorkloadEndpoint> {
  return Object.fromEntries(
    Object.entries(allEndpoints).filter(
      ([, ep]) => ep.schema?.content && ep.schema.content.trim().length > 0,
    ),
  );
}

/**
 * Extracts dependency connections from a workload's spec.
 */
export function extractWorkloadDependencies(
  workload: NewWorkload,
): WorkloadDependency[] {
  const spec = workload.spec as
    | { dependencies?: { endpoints?: WorkloadDependency[] } }
    | undefined;
  return spec?.dependencies?.endpoints || [];
}

// ────────────────────────────────────────────────────────────────────────
// API ref derivation (Option A — no schema-presence filter)
// ────────────────────────────────────────────────────────────────────────

/**
 * Computes a Component entity's `providesApis` and `consumesApis` ref
 * arrays from already-extracted workload data.
 *
 * - `providesApis` is derived purely from this workload's schemaful
 *   endpoints, named `<project>-<component>-<endpoint>`.
 * - `consumesApis` is the literal list of declared dependencies in
 *   `workload.spec.dependencies.endpoints`. We do **not** peek at the
 *   target workload to confirm the target endpoint has a schema (Option
 *   A). Backstage's built-in processor will emit `consumesApi` /
 *   `apiConsumedBy` relations from these strings; if the target API
 *   entity exists the graph completes, otherwise the edge dangles
 *   harmlessly until the target's schema is added.
 *
 * Used by both the periodic full sync and the per-event delta path so
 * both produce identical `providesApis` / `consumesApis` content.
 */
export function resolveProvidesAndConsumes(
  schemaEndpoints: Record<string, WorkloadEndpoint>,
  dependencies: WorkloadDependency[],
  projectName: string,
  componentName: string,
): { providesApis?: string[]; consumesApis?: string[] } {
  const providesApis =
    Object.keys(schemaEndpoints).length > 0
      ? Object.keys(schemaEndpoints).map(
          epName => `${projectName}-${componentName}-${epName}`,
        )
      : undefined;

  const consumesApiRefs = dependencies.map(dep => {
    const targetProject = dep.project ?? projectName;
    return `${targetProject}-${dep.component}-${dep.name}`;
  });
  const consumesApis = consumesApiRefs.length > 0 ? consumesApiRefs : undefined;

  return { providesApis, consumesApis };
}

// ────────────────────────────────────────────────────────────────────────
// API entity construction from workload endpoints
// ────────────────────────────────────────────────────────────────────────

/**
 * Maps an endpoint schema type (openapi/graphql/grpc/asyncapi/...) to the
 * Backstage `spec.type` value.
 */
export function mapSchemaTypeToBackstageApiType(
  schemaType: string | undefined,
): string {
  if (!schemaType) return 'openapi';
  const normalized = schemaType.toLowerCase();
  switch (normalized) {
    case 'openapi':
      return 'openapi';
    case 'graphql':
      return 'graphql';
    case 'grpc':
      return 'grpc';
    case 'asyncapi':
      return 'asyncapi';
    default:
      return normalized;
  }
}

/**
 * Returns the schema content for an endpoint, or a placeholder when the
 * endpoint declares no schema.
 */
export function createApiDefinitionFromWorkloadEndpoint(
  endpoint: WorkloadEndpoint,
): string {
  if (endpoint.schema?.content) {
    return endpoint.schema.content;
  }
  return 'No schema available';
}

/**
 * Normalizes an observability-plane reference into a `<namespace>/<name>`
 * string. Accepts either a plain string or an object with a `name` field.
 */
export function normalizeObservabilityPlaneRef(
  ref: unknown,
  namespaceName: string,
): string {
  if (!ref) return '';
  let name: string;
  if (typeof ref === 'string') {
    name = ref;
  } else if (typeof ref === 'object' && ref !== null && 'name' in ref) {
    name = (ref as { name: string }).name;
  } else {
    return '';
  }
  // If the name already contains a namespace qualifier, return as-is
  if (name.includes('/')) return name;
  return `${namespaceName}/${name}`;
}

/**
 * Creates Backstage API entities from a Workload's schema-bearing
 * endpoints. One API entity is produced per endpoint.
 */
export function createApiEntitiesFromNewWorkload(args: {
  componentName: string;
  endpoints: Record<string, WorkloadEndpoint>;
  namespaceName: string;
  projectName: string;
  owner: string;
  locationKey: string;
  /**
   * The owning Workload's `metadata.name`. Stamped onto each API entity
   * as `openchoreo.io/workload` so the workload-deletion event handler
   * can find these API entities by catalog query (without keeping
   * in-memory state) and remove them when the source workload disappears.
   */
  workloadName: string;
}): Entity[] {
  const {
    componentName,
    endpoints,
    namespaceName,
    projectName,
    owner,
    locationKey,
    workloadName,
  } = args;

  const apiEntities: Entity[] = [];

  Object.entries(endpoints).forEach(([endpointName, endpoint]) => {
    const apiEntity: Entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'API',
      metadata: {
        name: `${projectName}-${componentName}-${endpointName}`,
        namespace: namespaceName,
        title: `${componentName} ${endpointName} API`,
        description: `${
          endpoint.schema?.type || endpoint.type
        } API for ${componentName} on port ${endpoint.port}`,
        tags: [
          'openchoreo',
          'api',
          (endpoint.schema?.type || endpoint.type).toLowerCase(),
        ],
        annotations: {
          'backstage.io/managed-by-location': locationKey,
          'backstage.io/managed-by-origin-location': locationKey,
          [CHOREO_ANNOTATIONS.COMPONENT]: componentName,
          [CHOREO_ANNOTATIONS.ENDPOINT_NAME]: endpointName,
          [CHOREO_ANNOTATIONS.ENDPOINT_TYPE]: endpoint.type,
          [CHOREO_ANNOTATIONS.ENDPOINT_PORT]: endpoint.port.toString(),
          [CHOREO_ANNOTATIONS.ENDPOINT_VISIBILITY]:
            endpoint.visibility?.join(',') ?? '',
          [CHOREO_ANNOTATIONS.PROJECT]: projectName,
          [CHOREO_ANNOTATIONS.NAMESPACE]: namespaceName,
          [CHOREO_ANNOTATIONS.WORKLOAD]: workloadName,
        },
        labels: {
          'openchoreo.io/managed': 'true',
        },
      },
      spec: {
        type: mapSchemaTypeToBackstageApiType(endpoint.schema?.type),
        lifecycle: 'production',
        owner,
        system: projectName,
        definition: createApiDefinitionFromWorkloadEndpoint(endpoint),
      },
    };

    apiEntities.push(apiEntity);
  });

  return apiEntities;
}
