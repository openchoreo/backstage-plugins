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
import { useScoreResults } from './useScoreResults';

const system = entity('System', 'payments', ['component:default/api']);
const api = entity('Component', 'api', ['releaseline:default/next']);
const next = entity('ReleaseLine', 'next');

const own: Record<string, MaturityCheckResult[]> = {
  'system:default/payments': [],
  'component:default/api': [result('readme', Rank.Silver, true)],
  'releaseline:default/next': [result('readme', Rank.Silver, false)],
};

const variantsConfig = {
  techInsights: {
    scorecards: {
      variants: { kind: 'ReleaseLine', parentKind: 'Component' },
    },
  },
};

function setup(
  checks: { id: string; filter: unknown }[] = [
    { id: 'readme', filter: { kind: 'Component' } },
  ],
) {
  const catalogApi = {
    getEntityFacets: jest.fn(async () => ({
      facets: {
        kind: [
          { value: 'Component', count: 1 },
          { value: 'ReleaseLine', count: 1 },
          { value: 'System', count: 1 },
        ],
      },
    })),
    getEntities: jest.fn(
      async ({ filter }: { filter: { kind: string[] } }) => ({
        items: [system, api, next].filter(e =>
          filter.kind
            .map(k => k.toLocaleLowerCase('en-US'))
            .includes(e.kind.toLocaleLowerCase('en-US')),
        ),
      }),
    ),
  };
  const maturityApi = {
    getAllChecks: jest.fn(async () => checks),
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
        [configApiRef, mockApis.config({ data: variantsConfig })],
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

  it('lists release lines under their component, not as a kind', async () => {
    const { catalogApi, wrapper } = setup([
      { id: 'readme', filter: { kind: ['Component', 'ReleaseLine'] } },
    ]);
    const { result: hook } = renderHook(
      () => useScoreResults(undefined, 0, true),
      { wrapper },
    );
    await waitFor(() => expect(hook.current.value).toBeDefined());

    expect(catalogApi.getEntities).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: { kind: expect.arrayContaining(['ReleaseLine']) },
      }),
    );
    const { kinds, entities } = hook.current.value!;
    expect(kinds).toEqual(['Component']);
    expect(entities.map(e => e.ref)).toEqual(['component:default/api']);
    // The line's failing check leaves the component's tier alone.
    expect(entities[0]).toMatchObject({
      rank: Rank.Silver,
      descendantCount: 0,
    });
    expect(entities[0].variants.map(v => v.ref)).toEqual([
      'releaseline:default/next',
    ]);
  });

  it('skips release lines when no component is scored or rolled up', async () => {
    const { catalogApi, wrapper } = setup([
      { id: 'readme', filter: { kind: 'System' } },
    ]);
    const { result: hook } = renderHook(
      () => useScoreResults(['System'], 0, true),
      { wrapper },
    );
    await waitFor(() => expect(hook.current.value).toBeDefined());

    const [{ filter }] = catalogApi.getEntities.mock.calls[0];
    expect(filter.kind).not.toContain('ReleaseLine');
  });
});
