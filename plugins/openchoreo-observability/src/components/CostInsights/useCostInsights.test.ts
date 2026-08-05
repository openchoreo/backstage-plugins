import { renderHook, waitFor } from '@testing-library/react';
import { useApi } from '@backstage/core-plugin-api';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { useCostInsights } from './useCostInsights';
import type { UseCostInsightsParams } from './useCostInsights';

jest.mock('@backstage/core-plugin-api', () => {
  const actual = jest.requireActual('@backstage/core-plugin-api');
  return { ...actual, useApi: jest.fn() };
});

// The component-level path fetches release-binding info to detect stale
// recommendations; stub it to no bindings so it's a no-op here.
jest.mock('./optimizeChange', () => ({
  ...jest.requireActual('./optimizeChange'),
  fetchBindingInfoByEnv: jest.fn().mockResolvedValue(new Map()),
}));
import { fetchBindingInfoByEnv } from './optimizeChange';

const mockFetchBindingInfo = fetchBindingInfoByEnv as jest.MockedFunction<
  typeof fetchBindingInfoByEnv
>;

// Keep the real caching wrapper; only pin the window so previous-window maths
// and the per-env call args are deterministic.
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  ...jest.requireActual('@openchoreo/backstage-plugin-react'),
  calculateTimeRange: jest.fn().mockReturnValue({
    startTime: '2026-07-02T00:00:00.000Z',
    endTime: '2026-07-02T01:00:00.000Z',
  }),
}));

const costItem = (over: Record<string, unknown> = {}) => ({
  component: 'comp',
  startTime: '2026-07-02T00:00:00.000Z',
  endTime: '2026-07-02T01:00:00.000Z',
  environment: 'dev',
  project: 'gcp',
  namespace: 'default',
  cpuCost: 10,
  memoryCost: 12,
  efficiency: 0.3,
  ...over,
});

const baseParams = (
  over: Partial<UseCostInsightsParams> = {},
): UseCostInsightsParams => ({
  scope: { namespace: 'default' },
  environments: ['dev'],
  timeRange: '1h',
  view: 'table',
  granularity: '1d',
  ...over,
});

describe('useCostInsights', () => {
  const getCosts = jest.fn();
  const getCostRecommendations = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useApi as jest.Mock).mockReturnValue({
      getCosts,
      getCostRecommendations,
      getBaseUrl: jest.fn().mockResolvedValue('http://openchoreo'),
      fetch: jest.fn(),
    });
    getCosts.mockResolvedValue({ items: [costItem()] });
    getCostRecommendations.mockResolvedValue({ items: [] });
  });

  it('fetches a current and previous window per environment and aggregates', async () => {
    const { result } = renderHook(
      () => useCostInsights(baseParams({ environments: ['dev', 'prod'] })),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    // 2 envs × (current + previous) = 4 cost calls; recommendations only at the
    // component level, so none here.
    expect(getCosts).toHaveBeenCalledTimes(4);
    expect(getCostRecommendations).not.toHaveBeenCalled();
    expect(result.current.data?.level).toBe('namespace');
    expect(result.current.data?.rows.map(r => r.key)).toContain('gcp');
    expect(result.current.error).toBeNull();
  });

  it('requests recommendations at the component level', async () => {
    getCostRecommendations.mockResolvedValue({
      items: [
        {
          component: 'comp',
          environment: 'dev',
          project: 'gcp',
          namespace: 'default',
          current: { cpuCost: 22, memoryCost: 0 },
          recommendation: { cpuCost: 5, memoryCost: 3 },
        },
      ],
    });

    const { result } = renderHook(
      () =>
        useCostInsights(
          baseParams({
            scope: { namespace: 'default', project: 'gcp', component: 'comp' },
            environments: ['dev'],
          }),
        ),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getCostRecommendations).toHaveBeenCalledTimes(1);
    const devRow = result.current.data?.rows.find(r => r.key === 'dev');
    expect(devRow?.recommendation?.total).toBe(8);
  });

  it('withholds a recommendation when the binding changed after the window started', async () => {
    getCostRecommendations.mockResolvedValue({
      items: [
        {
          component: 'comp',
          environment: 'dev',
          project: 'gcp',
          namespace: 'default',
          current: { cpuCost: 22, memoryCost: 0, cpuRequest: '100m' },
          recommendation: { cpuCost: 5, memoryCost: 3, cpuRequest: '50m' },
        },
      ],
    });
    // Spec updated at the window start -> within the settling buffer -> stale.
    mockFetchBindingInfo.mockResolvedValueOnce(
      new Map([['dev', { lastSpecUpdateTime: '2026-07-02T00:00:00.000Z' }]]),
    );

    const { result } = renderHook(
      () =>
        useCostInsights(
          baseParams({
            scope: { namespace: 'default', project: 'gcp', component: 'comp' },
            environments: ['dev'],
          }),
        ),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    const devRow = result.current.data?.rows.find(r => r.key === 'dev');
    expect(devRow?.recommendationStale).toBe(true);
    expect(devRow?.recommendationStaleSince).toBe('2026-07-02T00:00:00.000Z');
    expect(devRow?.recommendation).toBeUndefined();
  });

  it('overrides the recommendation current request with live spec values', async () => {
    getCostRecommendations.mockResolvedValue({
      items: [
        {
          component: 'comp',
          environment: 'dev',
          project: 'gcp',
          namespace: 'default',
          current: { cpuCost: 22, memoryCost: 0, cpuRequest: '100m' },
          recommendation: { cpuCost: 5, memoryCost: 3, cpuRequest: '50m' },
        },
      ],
    });
    // Spec updated well before the window -> not stale; live request wins.
    mockFetchBindingInfo.mockResolvedValueOnce(
      new Map([
        [
          'dev',
          {
            cpuRequest: '250m',
            lastSpecUpdateTime: '2026-06-01T00:00:00.000Z',
          },
        ],
      ]),
    );

    const { result } = renderHook(
      () =>
        useCostInsights(
          baseParams({
            scope: { namespace: 'default', project: 'gcp', component: 'comp' },
            environments: ['dev'],
          }),
        ),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    const devRow = result.current.data?.rows.find(r => r.key === 'dev');
    expect(devRow?.recommendationStale).toBe(false);
    expect(devRow?.recommendation?.current?.cpuRequest).toBe('250m');
  });

  it('passes the granularity only in graph view', async () => {
    const { result } = renderHook(
      () => useCostInsights(baseParams({ view: 'graph', granularity: '6h' })),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    // The first call is the current window and carries the granularity.
    expect(getCosts.mock.calls[0][2]).toEqual(
      expect.objectContaining({ granularity: '6h' }),
    );
  });

  it('is disabled without a namespace or environments', async () => {
    const { result: noNs } = renderHook(
      () => useCostInsights(baseParams({ scope: {} })),
      { wrapper: createQueryWrapper() },
    );
    const { result: noEnvs } = renderHook(
      () => useCostInsights(baseParams({ environments: [] })),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(noNs.current.loading).toBe(false));
    await waitFor(() => expect(noEnvs.current.loading).toBe(false));
    expect(getCosts).not.toHaveBeenCalled();
  });

  it('keeps resolved environments when only some fail', async () => {
    getCosts.mockImplementation((_ns: string, env: string) =>
      env === 'bad'
        ? Promise.reject(new Error('env disabled'))
        : Promise.resolve({ items: [costItem({ environment: env })] }),
    );

    const { result } = renderHook(
      () => useCostInsights(baseParams({ environments: ['dev', 'bad'] })),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.data?.rows.length).toBeGreaterThan(0);
  });

  it('errors only when every environment fails', async () => {
    getCosts.mockRejectedValue(new Error('all down'));

    const { result } = renderHook(
      () => useCostInsights(baseParams({ environments: ['dev', 'prod'] })),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.error).toBe('all down'));
    expect(result.current.data).toBeUndefined();
  });
});
