import {
  RELATION_PART_OF,
  RELATION_HAS_PART,
  RELATION_OWNED_BY,
  RELATION_OWNER_OF,
} from '@backstage/catalog-model';
import {
  RELATION_PROMOTES_TO,
  RELATION_PROMOTED_BY,
  RELATION_USES_PIPELINE,
  RELATION_PIPELINE_USED_BY,
  RELATION_HOSTED_ON,
  RELATION_HOSTS,
  RELATION_OBSERVED_BY,
  RELATION_OBSERVES,
  RELATION_BUILDS_ON,
  RELATION_BUILDS,
} from '@openchoreo/backstage-plugin-common';

export type GraphViewDefinition = {
  id: string;
  label: string;
  description: string;
  kinds: string[];
  relations: string[];
  relationPairs: [string, string][];
};

/** Special Backstage catalog namespace used for cluster-scoped entities. */
export const CLUSTER_NAMESPACE = 'openchoreo-cluster';

/** Entity kinds that are cluster-scoped (live in CLUSTER_NAMESPACE). */
export const CLUSTER_SCOPED_KINDS = [
  'clusterdataplane',
  'clusterworkflowplane',
  'clusterobservabilityplane',
  'clusterworkflow',
];

export const APPLICATION_VIEW: GraphViewDefinition = {
  id: 'developer',
  label: 'Developer Resources',
  description: 'Projects, Components, Deployment Pipelines, and Environments',
  kinds: ['system', 'component', 'deploymentpipeline', 'environment'],
  relations: [
    RELATION_PART_OF,
    RELATION_HAS_PART,
    RELATION_OWNED_BY,
    RELATION_OWNER_OF,
    RELATION_PROMOTES_TO,
    RELATION_PROMOTED_BY,
    RELATION_USES_PIPELINE,
    RELATION_PIPELINE_USED_BY,
  ],
  relationPairs: [
    [RELATION_PART_OF, RELATION_HAS_PART],
    [RELATION_OWNED_BY, RELATION_OWNER_OF],
    [RELATION_PROMOTES_TO, RELATION_PROMOTED_BY],
    [RELATION_USES_PIPELINE, RELATION_PIPELINE_USED_BY],
  ],
};

export const INFRASTRUCTURE_VIEW: GraphViewDefinition = {
  id: 'platform',
  label: 'Platform Resources',
  description:
    'Data Planes, Workflow Planes, Observability Planes, Workflows, and Environments',
  kinds: [
    'dataplane',
    'workflowplane',
    'observabilityplane',
    'environment',
    'workflow',
  ],
  relations: [
    RELATION_HOSTED_ON,
    RELATION_HOSTS,
    RELATION_OBSERVED_BY,
    RELATION_OBSERVES,
    RELATION_PROMOTES_TO,
    RELATION_PROMOTED_BY,
    RELATION_BUILDS_ON,
    RELATION_BUILDS,
  ],
  relationPairs: [
    [RELATION_HOSTED_ON, RELATION_HOSTS],
    [RELATION_OBSERVED_BY, RELATION_OBSERVES],
    [RELATION_PROMOTES_TO, RELATION_PROMOTED_BY],
    [RELATION_BUILDS_ON, RELATION_BUILDS],
  ],
};

export const CLUSTER_VIEW: GraphViewDefinition = {
  id: 'cluster',
  label: 'Cluster Resources',
  description:
    'Cluster Data Planes, Cluster Workflow Planes, and Cluster Observability Planes',
  kinds: [
    'clusterdataplane',
    'clusterworkflowplane',
    'clusterobservabilityplane',
    'clusterworkflow',
  ],
  relations: [
    RELATION_HOSTED_ON,
    RELATION_HOSTS,
    RELATION_OBSERVED_BY,
    RELATION_OBSERVES,
    RELATION_BUILDS_ON,
    RELATION_BUILDS,
  ],
  relationPairs: [
    [RELATION_HOSTED_ON, RELATION_HOSTS],
    [RELATION_OBSERVED_BY, RELATION_OBSERVES],
    [RELATION_BUILDS_ON, RELATION_BUILDS],
  ],
};

export const ALL_VIEWS: GraphViewDefinition[] = [
  APPLICATION_VIEW,
  INFRASTRUCTURE_VIEW,
  CLUSTER_VIEW,
];

// --- Filter-based view system ---

export type FilterPreset = {
  id: string;
  label: string;
  kinds: string[];
};

const ALL_KINDS = [
  ...new Set([
    ...APPLICATION_VIEW.kinds,
    ...INFRASTRUCTURE_VIEW.kinds,
    ...CLUSTER_VIEW.kinds,
  ]),
];

/**
 * Returns filter presets dynamically based on whether cluster scope is active.
 * When cluster scope is active, "All" and "Platform Resources" include cluster kinds.
 * When off, cluster kinds are excluded entirely.
 */
export function getFilterPresets(clusterScopeActive: boolean): FilterPreset[] {
  const allKinds = clusterScopeActive
    ? ALL_KINDS
    : [...new Set([...APPLICATION_VIEW.kinds, ...INFRASTRUCTURE_VIEW.kinds])];
  const platformKinds = clusterScopeActive
    ? [...INFRASTRUCTURE_VIEW.kinds, ...CLUSTER_VIEW.kinds]
    : INFRASTRUCTURE_VIEW.kinds;

  return [
    { id: 'all', label: 'All', kinds: allKinds },
    {
      id: 'developer',
      label: 'Developer Resources',
      kinds: APPLICATION_VIEW.kinds,
    },
    {
      id: 'platform',
      label: 'Platform Resources',
      kinds: platformKinds,
    },
  ];
}

/** @deprecated Use getFilterPresets() instead */
export const FILTER_PRESETS: FilterPreset[] = getFilterPresets(true);

export const ALL_FILTERABLE_KINDS: {
  id: string;
  label: string;
  clusterScoped?: boolean;
}[] = [
  { id: 'system', label: 'Project' },
  { id: 'component', label: 'Component' },
  { id: 'deploymentpipeline', label: 'Pipeline' },
  { id: 'environment', label: 'Environment' },
  { id: 'dataplane', label: 'Data Plane' },
  { id: 'workflow', label: 'Workflow' },
  { id: 'workflowplane', label: 'Workflow Plane' },
  { id: 'observabilityplane', label: 'Obs Plane' },
  // Cluster-scoped kinds
  { id: 'clusterdataplane', label: 'Cluster Data Plane', clusterScoped: true },
  {
    id: 'clusterworkflowplane',
    label: 'Cluster Workflow Plane',
    clusterScoped: true,
  },
  {
    id: 'clusterobservabilityplane',
    label: 'Cluster Obs Plane',
    clusterScoped: true,
  },
  {
    id: 'clusterworkflow',
    label: 'Cluster Workflow',
    clusterScoped: true,
  },
];

const VIEW_SOURCES = [APPLICATION_VIEW, INFRASTRUCTURE_VIEW, CLUSTER_VIEW];

/**
 * Returns the effective set of kinds to fetch, accounting for cluster scope.
 * When cluster scope is off, strips out cluster-scoped kinds.
 * When cluster scope is on, passes through selectedKinds as-is (the kind
 * filter and presets already manage cluster kind inclusion).
 */
export function getEffectiveKinds(
  selectedKinds: string[],
  clusterScopeActive: boolean,
): string[] {
  if (!clusterScopeActive) {
    return selectedKinds.filter(k => !CLUSTER_SCOPED_KINDS.includes(k));
  }
  return selectedKinds;
}

/**
 * Builds a dynamic GraphViewDefinition by merging relations from all views
 * whose kinds overlap with the selected set.
 */
export function buildDynamicView(selectedKinds: string[]): GraphViewDefinition {
  const kindsSet = new Set(selectedKinds);
  const relations = new Set<string>();
  const pairMap = new Map<string, [string, string]>();

  for (const view of VIEW_SOURCES) {
    if (view.kinds.some(k => kindsSet.has(k))) {
      for (const r of view.relations) relations.add(r);
      for (const pair of view.relationPairs) {
        pairMap.set(pair.join('|'), pair);
      }
    }
  }

  // Find matching preset for description (check both cluster states)
  const matchingPreset = getFilterPresets(true)
    .concat(getFilterPresets(false))
    .find(p => {
      const presetSet = new Set(p.kinds);
      return (
        presetSet.size === kindsSet.size && p.kinds.every(k => kindsSet.has(k))
      );
    });

  const label = matchingPreset?.label ?? 'Custom View';
  const description = matchingPreset
    ? ALL_FILTERABLE_KINDS.filter(k => kindsSet.has(k.id))
        .map(k => k.label)
        .join(', ')
    : ALL_FILTERABLE_KINDS.filter(k => kindsSet.has(k.id))
        .map(k => k.label)
        .join(', ');

  return {
    id: matchingPreset?.id ?? 'custom',
    label,
    description: description || 'No entity kinds selected',
    kinds: selectedKinds,
    relations: Array.from(relations),
    relationPairs: Array.from(pairMap.values()),
  };
}
