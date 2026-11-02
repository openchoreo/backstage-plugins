import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { TestApiProvider } from '@backstage/test-utils';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef, type Entity } from '@backstage/catalog-model';
import { maturityApiRef } from '@backstage-community/plugin-tech-insights-maturity';
import {
  Rank,
  type MaturityCheckResult,
} from '@backstage-community/plugin-tech-insights-maturity-common';
import { entity, result } from '../../testUtils';
import { useScoreResults } from './useScoreResults';

const system = entity('System', 'payments', ['component:default/api']);
const api = entity('Component', 'api');

const own: Record<string, MaturityCheckResult[]> = {
  'system:default/payments': [],
  'component:default/api': [result('readme', Rank.Silver, true)],
};

function setup() {
  const catalogApi = {
    getEntityFacets: jest.fn(async () => ({
      facets: {
        kind: [
          { value: 'Component', count: 1 },
          { value: 'System', count: 1 },
        ],
      },
    })),
    getEntities: jest.fn(
      async ({ filter }: { filter: { kind: string[] } }) => ({
        items: [system, api].filter(e =>
          filter.kind
            .map(k => k.toLocaleLowerCase('en-US'))
            .includes(e.kind.toLocaleLowerCase('en-US')),
        ),
      }),
    ),
  };
  const maturityApi = {
    getAllChecks: jest.fn(async () => [
      { id: 'readme', filter: { kind: 'Component' } },
    ]),
    getBulkMaturityCheckResults: jest.fn(async (entities: Entity[]) =>
      entities.map(e => {
        const ref = stringifyEntityRef(e);
        return { entity: ref, rank: 0, isMaxRank: false, checks: own[ref] };
      }),
    ),
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <TestApiProvider
      apis={[
        [catalogApiRef, catalogApi],
        [maturityApiRef, maturityApi as unknown as typeof maturityApiRef.T],
      ]}
    >
      {children}
    </TestApiProvider>
  );
  return { catalogApi, wrapper };
}

describe('useScoreResults', () => {
  it('combines the kinds checks apply to into listed kinds that leave them out', async () => {
    const { wrapper } = setup();
    const { result: hook } = renderHook(
      () => useScoreResults(['System'], 0, true),
      { wrapper },
    );
    await waitFor(() => expect(hook.current.value).toBeDefined());

    const { kinds, entities } = hook.current.value!;
    expect(kinds).toEqual(['System']);
    expect(entities).toHaveLength(1);
    expect(entities[0]).toMatchObject({
      ref: 'system:default/payments',
      scored: true,
      rank: Rank.Silver,
      descendantCount: 1,
    });
  });
});
