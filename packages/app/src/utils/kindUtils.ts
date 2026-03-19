// Mapping of internal kind names (lowercase) to OpenChoreo display names
export const kindDisplayNames: Record<string, string> = {
  domain: 'Namespace',
  system: 'Project',
  component: 'Component',
  api: 'API',
  user: 'User',
  group: 'Group',
  resource: 'Resource',
  location: 'Location',
  template: 'Template',
  dataplane: 'Dataplane',
  clusterdataplane: 'Cluster Data Plane',
  workflowplane: 'Workflow Plane',
  observabilityplane: 'Observability Plane',
  clusterobservabilityplane: 'Cluster Observability Plane',
  clusterworkflowplane: 'Cluster Workflow Plane',
  environment: 'Environment',
  deploymentpipeline: 'Deployment Pipeline',
  componenttype: 'Component Type',
  clustercomponenttype: 'Cluster Component Type',
  traittype: 'Trait Type',
  clustertraittype: 'Cluster Trait Type',
  workflow: 'Workflow',
  clusterworkflow: 'Cluster Workflow',
  componentworkflow: 'Component Workflow',
};

export interface KindCategory {
  label: string;
  kinds: string[];
}

export const kindCategories: KindCategory[] = [
  {
    label: 'Developer Resources',
    kinds: ['system', 'component', 'api', 'resource'],
  },
  {
    label: 'Platform Resources',
    kinds: [
      'dataplane',
      'clusterdataplane',
      'workflowplane',
      'clusterworkflowplane',
      'observabilityplane',
      'clusterobservabilityplane',
      'environment',
      'deploymentpipeline',
    ],
  },
  {
    label: 'Platform Configuration',
    kinds: [
      'clustercomponenttype',
      'componenttype',
      'clustertraittype',
      'traittype',
      'clusterworkflow',
      'workflow',
      'componentworkflow',
    ],
  },
  {
    label: 'Backstage',
    kinds: ['user', 'group', 'location', 'template'],
  },
];

export function getKindDisplayName(kind: string): string {
  return kindDisplayNames[kind.toLowerCase()] || kind;
}

export interface CatalogPageEntry {
  kind: string;
  displayName: string;
  path: string;
}

// Special route overrides for kinds that don't use the standard catalog filter path
const kindPathOverrides: Record<string, string> = {
  template: '/create',
};

// Generate catalog page entries from all kinds in kindCategories + domain
export const catalogPageEntries: CatalogPageEntry[] = [
  'domain',
  ...kindCategories.flatMap(c => c.kinds),
].map(kind => ({
  kind,
  displayName: kindDisplayNames[kind] || kind,
  path: kindPathOverrides[kind] || `/catalog?filters[kind]=${kind}`,
}));

// All kind values for the search page Kind filter.
// Must match PascalCase used by the catalog collator.
export const allSearchFilterKinds: string[] = [
  'Component',
  'API',
  'System',
  'Domain',
  'Resource',
  'Template',
  'User',
  'Group',
  'Location',
  'DataPlane',
  'ClusterDataPlane',
  'WorkflowPlane',
  'ClusterWorkflowPlane',
  'ObservabilityPlane',
  'ClusterObservabilityPlane',
  'Environment',
  'DeploymentPipeline',
  'ComponentType',
  'ClusterComponentType',
  'TraitType',
  'ClusterTraitType',
  'Workflow',
  'ClusterWorkflow',
  'ComponentWorkflow',
];
