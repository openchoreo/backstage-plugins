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
} from '@openchoreo/backstage-plugin-common';

export type GraphViewDefinition = {
  id: string;
  label: string;
  description: string;
  kinds: string[];
  relations: string[];
  relationPairs: [string, string][];
};

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
    'Data Planes, Build Planes, Observability Planes, and Environments',
  kinds: ['dataplane', 'buildplane', 'observabilityplane', 'environment'],
  relations: [
    RELATION_HOSTED_ON,
    RELATION_HOSTS,
    RELATION_OBSERVED_BY,
    RELATION_OBSERVES,
    RELATION_PROMOTES_TO,
    RELATION_PROMOTED_BY,
  ],
  relationPairs: [
    [RELATION_HOSTED_ON, RELATION_HOSTS],
    [RELATION_OBSERVED_BY, RELATION_OBSERVES],
    [RELATION_PROMOTES_TO, RELATION_PROMOTED_BY],
  ],
};

export const ALL_VIEWS: GraphViewDefinition[] = [
  APPLICATION_VIEW,
  INFRASTRUCTURE_VIEW,
];

// --- Filter-based view system ---

export type FilterPreset = {
  id: string;
  label: string;
  kinds: string[];
};

const ALL_KINDS = [
  ...new Set([...APPLICATION_VIEW.kinds, ...INFRASTRUCTURE_VIEW.kinds]),
];

export const FILTER_PRESETS: FilterPreset[] = [
  { id: 'all', label: 'All', kinds: ALL_KINDS },
  {
    id: 'developer',
    label: 'Developer Resources',
    kinds: APPLICATION_VIEW.kinds,
  },
  {
    id: 'platform',
    label: 'Platform Resources',
    kinds: INFRASTRUCTURE_VIEW.kinds,
  },
];

export const ALL_FILTERABLE_KINDS: { id: string; label: string }[] = [
  { id: 'system', label: 'Project' },
  { id: 'component', label: 'Component' },
  { id: 'deploymentpipeline', label: 'Pipeline' },
  { id: 'environment', label: 'Environment' },
  { id: 'dataplane', label: 'Data Plane' },
  { id: 'buildplane', label: 'Build Plane' },
  { id: 'observabilityplane', label: 'Obs Plane' },
];

const VIEW_SOURCES = [APPLICATION_VIEW, INFRASTRUCTURE_VIEW];

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

  // Find matching preset for description
  const matchingPreset = FILTER_PRESETS.find(p => {
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
