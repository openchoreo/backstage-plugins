import { renderHook, waitFor } from '@testing-library/react';
import { useApi } from '@backstage/core-plugin-api';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { usePlatformLogFilterValues } from './usePlatformLogFilterValues';
import {
  DEFAULT_PLATFORM_LOG_FIELDS,
  PLATFORM_LOG_LEVELS,
  PlatformLogsFilters,
} from '../components/PlatformLogs/types';

jest.mock('@backstage/core-plugin-api', () => {
  const actual = jest.requireActual('@backstage/core-plugin-api');
  return { ...actual, useApi: jest.fn() };
});

const getPlatformLogFilterValues = jest.fn();

const filters = (
  over: Partial<PlatformLogsFilters> = {},
): PlatformLogsFilters => ({
  observabilityPlane: 'observabilityplane:default/main',
  selectedFields: DEFAULT_PLATFORM_LOG_FIELDS,
  clusterInstances: [],
  namespaces: [],
  podNames: [],
  containerNames: [],
  labels: '',
  logLevel: [...PLATFORM_LOG_LEVELS],
  timeRange: '10m',
  sortOrder: 'desc',
  ...over,
});

const answered = (over: Record<string, unknown> = {}) => ({
  filter: 'podName',
  values: [{ value: 'controller-manager-abc', count: 412 }],
  totalValues: 1,
  tookMs: 3,
  ...over,
});

const setup = (
  filter: Parameters<typeof usePlatformLogFilterValues>[1] = 'podName',
  f: PlatformLogsFilters = filters(),
  valueSearch = '',
) =>
  renderHook(
    () =>
      usePlatformLogFilterValues(
        'http://observer.example',
        filter,
        f,
        valueSearch,
      ),
    { wrapper: createQueryWrapper() },
  );

beforeEach(() => {
  jest.clearAllMocks();
  (useApi as jest.Mock).mockReturnValue({ getPlatformLogFilterValues });
  getPlatformLogFilterValues.mockResolvedValue(answered());
});

describe('usePlatformLogFilterValues', () => {
  it('returns the values the observer reported', async () => {
    const { result } = setup();

    await waitFor(() => expect(result.current.values).not.toBeNull());
    expect(result.current.values).toEqual([
      { value: 'controller-manager-abc', count: 412 },
    ]);
  });

  // Each filter costs the observer an aggregation, so nothing is asked for until a
  // picker is actually open.
  it('asks for nothing while no picker is open', async () => {
    const { result } = setup(null);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getPlatformLogFilterValues).not.toHaveBeenCalled();
    expect(result.current.values).toBeNull();
  });

  it('sends the whole query, the named filter included', async () => {
    const applied = filters({
      podNames: ['already-selected'],
      namespaces: ['openchoreo-control-plane'],
      labels: 'openchoreo.dev/plane=controlplane',
      searchQuery: 'reconcile',
    });
    setup('podName', applied);

    await waitFor(() => expect(getPlatformLogFilterValues).toHaveBeenCalled());
    const [url, options] = getPlatformLogFilterValues.mock.calls[0];
    expect(url).toBe('http://observer.example');
    expect(options.filter).toBe('podName');
    expect(options.podNames).toEqual(['already-selected']);
    expect(options.namespaces).toEqual(['openchoreo-control-plane']);
    expect(options.labels).toBe('openchoreo.dev/plane=controlplane');
    expect(options.searchQuery).toBe('reconcile');
    // Resolved from the relative range rather than keyed on it.
    expect(Number.isNaN(Date.parse(options.startTime))).toBe(false);
    expect(Number.isNaN(Date.parse(options.endTime))).toBe(false);
  });

  // Every level selected is the same query as no level filter at all.
  it('omits the levels when they are all selected', async () => {
    setup();

    await waitFor(() => expect(getPlatformLogFilterValues).toHaveBeenCalled());
    expect(
      getPlatformLogFilterValues.mock.calls[0][1].logLevels,
    ).toBeUndefined();
  });

  it('sends the levels when only some are selected', async () => {
    setup('podName', filters({ logLevel: ['ERROR'] }));

    await waitFor(() => expect(getPlatformLogFilterValues).toHaveBeenCalled());
    expect(getPlatformLogFilterValues.mock.calls[0][1].logLevels).toEqual([
      'ERROR',
    ]);
  });

  // No level selected matches no record, so there is nothing to count - the same reason
  // the log query itself is not sent.
  it('asks for nothing when no level is selected', async () => {
    const { result } = setup('podName', filters({ logLevel: [] }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getPlatformLogFilterValues).not.toHaveBeenCalled();
  });

  it('forwards the type-ahead text', async () => {
    setup('podName', filters(), 'contro');

    await waitFor(() => expect(getPlatformLogFilterValues).toHaveBeenCalled());
    expect(getPlatformLogFilterValues.mock.calls[0][1].valueSearch).toBe(
      'contro',
    );
  });

  // Absent is not empty: a plane that cannot answer sends the caller to its fallback,
  // where a plane reporting no values is telling it something true.
  it('reports null when the observer cannot answer', async () => {
    getPlatformLogFilterValues.mockResolvedValue(null);
    const { result } = setup();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.values).toBeNull();
  });

  it('reports an empty answer as empty, not as unknown', async () => {
    getPlatformLogFilterValues.mockResolvedValue(answered({ values: [] }));
    const { result } = setup();

    await waitFor(() => expect(result.current.values).not.toBeNull());
    expect(result.current.values).toEqual([]);
  });

  it('falls back rather than surfacing a failure', async () => {
    getPlatformLogFilterValues.mockRejectedValue(
      new Error('observer exploded'),
    );
    const { result } = setup();

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.values).toBeNull();
    expect(result.current.error).toMatch(/observer exploded/);
  });

  // Every level selected and none selected both send no level filter, so they key
  // alike. The no-level query is disabled, but a disabled query still reads its entry
  // from the cache - which would offer values counted over records the table is not
  // showing, because with no level selected it is showing none.
  it('does not serve the all-level answer when no level is selected', async () => {
    const { result, rerender } = renderHook(
      ({ f }: { f: PlatformLogsFilters }) =>
        usePlatformLogFilterValues('http://observer.example', 'podName', f, ''),
      { wrapper: createQueryWrapper(), initialProps: { f: filters() } },
    );
    await waitFor(() => expect(result.current.values).not.toBeNull());

    rerender({ f: filters({ logLevel: [] }) });

    expect(result.current.values).toBeNull();
  });

  // The previous picker's answer is held while the new one loads, so it has to be told
  // apart - otherwise opening Pods after Namespaces lists namespaces under Pods.
  it('ignores an answer describing a different filter', async () => {
    getPlatformLogFilterValues.mockResolvedValue(
      answered({ filter: 'namespace' }),
    );
    const { result } = setup('podName');

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.values).toBeNull();
  });
});
