import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { mockApis, TestApiProvider } from '@backstage/test-utils';
import { configApiRef } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef, type Entity } from '@backstage/catalog-model';
import { maturityApiRef } from '@backstage-community/plugin-tech-insights-maturity';
import {
  Rank,
  type MaturityCheckResult,
} from '@backstage-community/plugin-tech-insights-maturity-common';
import { entity, result } from '../__testUtils__/fixtures';
import { useEntityScorecard } from './useEntityScorecard';

const domain = entity('Domain', 'default', ['system:default/payments']);
const system = entity('System', 'payments', ['component:default/api']);
const api = entity('Component', 'api');
const web = entity('Component', 'web', [
  'releaseline:default/next',
  'component:default/web-ui',
]);
const next = entity('ReleaseLine', 'next');
const shop = entity('System', 'shop', ['component:default/web']);
const catalog = new Map(
  [system, api, web, next, shop].map(e => [stringifyEntityRef(e), e]),
);

const own: Record<string, MaturityCheckResult[]> = {
  'domain:default/default': [],
  'system:default/payments': [result('tagged', Rank.Silver, true)],
  'component:default/api': [result('desc', Rank.Bronze, false)],
  'component:default/web': [result('desc', Rank.Bronze, true)],
  'releaseline:default/next': [result('desc', Rank.Bronze, false)],
};

const variantsConfig = {
  techInsights: {
    scorecards: {
      variants: { kind: 'ReleaseLine', parentKind: 'Component' },
    },
  },
};

function setup(
  config: typeof variantsConfig | Record<string, never> = variantsConfig,
) {
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
        [configApiRef, mockApis.config({ data: config })],
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

  it('scores a component’s release lines apart from it, in the same request', async () => {
    const { catalogApi, maturityApi, wrapper } = setup();
    const { result: hook } = renderHook(() => useEntityScorecard(web), {
      wrapper,
    });
    await waitFor(() => expect(hook.current.value).toBeDefined());
    // The subcomponent is also a hasPart target, but not a release line.
    expect(catalogApi.getEntitiesByRefs).toHaveBeenCalledTimes(1);
    expect(catalogApi.getEntitiesByRefs).toHaveBeenCalledWith(
      expect.objectContaining({ entityRefs: ['releaseline:default/next'] }),
    );
    expect(maturityApi.getBulkMaturityCheckResults).toHaveBeenCalledTimes(1);

    const { root, categories } = hook.current.value!;
    expect(root).toMatchObject({
      rank: Rank.Bronze,
      progress: { passedChecks: 1, totalChecks: 1 },
      descendantCount: 0,
      children: [],
    });
    expect(root.variants.map(v => v.ref)).toEqual(['releaseline:default/next']);
    expect(root.variants[0].rank).toBe(Rank.Stone);
    expect(categories).toEqual([
      expect.objectContaining({ totalChecks: 1, passedChecks: 1 }),
    ]);
  });

  it('fetches the release lines of the components in a System', async () => {
    const { wrapper } = setup();
    const { result: hook } = renderHook(() => useEntityScorecard(shop), {
      wrapper,
    });
    await waitFor(() => expect(hook.current.value).toBeDefined());

    const { root } = hook.current.value!;
    expect(root.rank).toBe(Rank.Bronze);
    expect(root.descendantCount).toBe(1);
    expect(root.children[0].variants.map(v => v.ref)).toEqual([
      'releaseline:default/next',
    ]);
  });

  it('leaves release lines alone without the variants config', async () => {
    const { catalogApi, wrapper } = setup({});
    const { result: hook } = renderHook(() => useEntityScorecard(web), {
      wrapper,
    });
    await waitFor(() => expect(hook.current.value).toBeDefined());
    expect(catalogApi.getEntitiesByRefs).not.toHaveBeenCalled();
    expect(hook.current.value!.root.variants).toEqual([]);
  });
});
