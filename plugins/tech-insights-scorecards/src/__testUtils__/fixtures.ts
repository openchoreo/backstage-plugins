import type { Entity } from '@backstage/catalog-model';
import type { MaturityCheckResult } from '@backstage-community/plugin-tech-insights-maturity-common';

export function result(
  id: string,
  rank: number,
  passed: boolean,
): MaturityCheckResult {
  return {
    result: passed,
    facts: {},
    check: {
      id,
      type: 'json-rules-engine',
      name: id,
      description: '',
      factIds: [],
      metadata: { rank, category: 'Security', solution: '', exp: 0 },
    },
  } as MaturityCheckResult;
}

export function entity(
  kind: string,
  name: string,
  parts: string[] = [],
  type = 'hasPart',
): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind,
    metadata: { name, namespace: 'default' },
    relations: parts.map(targetRef => ({ type, targetRef })),
  };
}
