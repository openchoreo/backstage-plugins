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
import { entity, result } from '../testUtils';
import { useEntityScorecard } from './useEntityScorecard';

const domain = entity('Domain', 'default', ['system:default/payments']);
const system = entity('System', 'payments', ['component:default/api']);
const api = entity('Component', 'api');
const catalog = new Map([system, api].map(e => [stringifyEntityRef(e), e]));

const own: Record<string, MaturityCheckResult[]> = {
  'domain:default/default': [],
  'system:default/payments': [result('tagged', Rank.Silver, true)],
  'component:default/api': [result('desc', Rank.Bronze, false)],
};

function setup() {
  const catalogApi = {
    getEntitiesByRefs: jest.fn(
      async ({ entityRefs }: { entityRefs: string[] }) => ({
        items: entityRefs.map(ref => catalog.get(ref)),
      }),
    ),
  };
  const maturityApi = {
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
        [maturityApiRef, maturityApi],
      ]}
    >
      {children}
    </TestApiProvider>
  );
  return { catalogApi, maturityApi, wrapper };
}

describe('useEntityScorecard', () => {
  it('scores a component on its own, without catalog lookups', async () => {
    const { catalogApi, wrapper } = setup();
    const { result: hook } = renderHook(() => useEntityScorecard(api), {
      wrapper,
    });
    await waitFor(() => expect(hook.current.value).toBeDefined());
    expect(hook.current.value!.root).toMatchObject({
      rank: Rank.Stone,
      children: [],
      descendantCount: 0,
    });
    expect(catalogApi.getEntitiesByRefs).not.toHaveBeenCalled();
  });

  it('fetches a Domain level by level and evaluates the tree in one request', async () => {
    const { catalogApi, maturityApi, wrapper } = setup();
    const { result: hook } = renderHook(() => useEntityScorecard(domain), {
      wrapper,
    });
    await waitFor(() => expect(hook.current.value).toBeDefined());
    expect(catalogApi.getEntitiesByRefs).toHaveBeenCalledTimes(2);
    expect(maturityApi.getBulkMaturityCheckResults).toHaveBeenCalledTimes(1);

    const { root, categories } = hook.current.value!;
    expect(root.children.map(c => c.ref)).toEqual(['system:default/payments']);
    expect(root.children[0].children.map(c => c.ref)).toEqual([
      'component:default/api',
    ]);
    // The project's own Silver check passes, but its component fails Bronze.
    expect(root.children[0].rank).toBe(Rank.Stone);
    expect(root.progress).toMatchObject({ passedChecks: 1, totalChecks: 2 });
    expect(categories).toEqual([
      expect.objectContaining({ category: 'Security', totalChecks: 2 }),
    ]);
  });
});
