import type { PlatformResourceKind } from '../../api/OpenChoreoClientApi';

/**
 * Maps a Backstage entity kind to the API path kind
 */
export function mapKindToApiKind(backstageKind: string): PlatformResourceKind {
  const kindLower = backstageKind.toLowerCase();
  switch (kindLower) {
    case 'componenttype':
      return 'componenttypes';
    case 'traittype':
      return 'traits';
    case 'workflow':
      return 'workflows';
    case 'componentworkflow':
      return 'component-workflows';
    case 'environment':
      return 'environments';
    case 'dataplane':
      return 'dataplanes';
    case 'buildplane':
      return 'buildplanes';
    case 'observabilityplane':
      return 'observabilityplanes';
    case 'deploymentpipeline':
      return 'deploymentpipelines';
    case 'clustercomponenttype':
      return 'clustercomponenttypes';
    case 'clustertraittype':
      return 'clustertraits';
    case 'clusterdataplane':
      return 'clusterdataplanes';
    case 'clusterobservabilityplane':
      return 'clusterobservabilityplanes';
    case 'clusterbuildplane':
      return 'clusterbuildplanes';
    default:
      throw new Error(`Unsupported entity kind: ${backstageKind}`);
  }
}

/**
 * Maps a Backstage entity kind to the actual CRD kind
 * (used to extract the resource name from the CRD)
 */
export function mapKindToCrdKind(backstageKind: string): string {
  const kindLower = backstageKind.toLowerCase();
  switch (kindLower) {
    case 'componenttype':
      return 'ComponentType';
    case 'traittype':
      return 'Trait'; // TraitType in Backstage maps to Trait CRD
    case 'workflow':
      return 'Workflow';
    case 'componentworkflow':
      return 'ComponentWorkflow';
    case 'environment':
      return 'Environment';
    case 'dataplane':
      return 'DataPlane';
    case 'buildplane':
      return 'BuildPlane';
    case 'observabilityplane':
      return 'ObservabilityPlane';
    case 'deploymentpipeline':
      return 'DeploymentPipeline';
    case 'clustercomponenttype':
      return 'ClusterComponentType';
    case 'clustertraittype':
      return 'ClusterTrait'; // ClusterTraitType in Backstage maps to ClusterTrait CRD
    case 'clusterdataplane':
      return 'ClusterDataPlane';
    case 'clusterobservabilityplane':
      return 'ClusterObservabilityPlane';
    case 'clusterbuildplane':
      return 'ClusterBuildPlane';
    default:
      throw new Error(`Unsupported entity kind: ${backstageKind}`);
  }
}

/**
 * Checks if an entity kind is cluster-scoped (no namespace required)
 */
export function isClusterScopedKind(kind: string): boolean {
  const kindLower = kind.toLowerCase();
  return [
    'clustercomponenttype',
    'clustertraittype',
    'clusterdataplane',
    'clusterobservabilityplane',
    'clusterbuildplane',
  ].includes(kindLower);
}

/**
 * Server-managed fields that should be stripped from CRD before displaying
 */
const SERVER_MANAGED_FIELDS = [
  'managedFields',
  'resourceVersion',
  'uid',
  'creationTimestamp',
  'generation',
];

/**
 * Cleans a CRD for editing by removing server-managed fields
 */
export function cleanCrdForEditing(
  crd: Record<string, unknown>,
): Record<string, unknown> {
  const cleaned = { ...crd };

  // Clean metadata
  if (cleaned.metadata && typeof cleaned.metadata === 'object') {
    const metadata = { ...(cleaned.metadata as Record<string, unknown>) };
    for (const field of SERVER_MANAGED_FIELDS) {
      delete metadata[field];
    }
    cleaned.metadata = metadata;
  }

  // Remove status (should not be edited by users)
  delete cleaned.status;

  return cleaned;
}

/**
 * Checks if an entity kind is supported for definition editing
 */
export function isSupportedKind(kind: string): boolean {
  const kindLower = kind.toLowerCase();
  return [
    'componenttype',
    'traittype',
    'workflow',
    'componentworkflow',
    'environment',
    'dataplane',
    'buildplane',
    'observabilityplane',
    'deploymentpipeline',
    'clustercomponenttype',
    'clustertraittype',
    'clusterdataplane',
    'clusterobservabilityplane',
    'clusterbuildplane',
  ].includes(kindLower);
}
