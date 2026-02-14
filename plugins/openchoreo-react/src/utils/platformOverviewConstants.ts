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
  id: 'application',
  label: 'Application',
  description:
    'Projects, Components, Deployment Pipelines, and Environments',
  kinds: [
    'system',
    'component',
    'deploymentpipeline',
    'environment',
  ],
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
  id: 'infrastructure',
  label: 'Infrastructure',
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
