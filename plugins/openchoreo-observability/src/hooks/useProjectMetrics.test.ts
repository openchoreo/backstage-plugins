import { renderHook, waitFor } from '@testing-library/react';
import { useApi } from '@backstage/core-plugin-api';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { useProjectMetrics } from './useProjectMetrics';
import { ProjectResourceMetrics } from '../types';

jest.mock('@backstage/core-plugin-api', () => {
  const actual = jest.requireActual('@backstage/core-plugin-api');
  return {
    ...actual,
    useApi: jest.fn(),
  };
});

describe('useProjectMetrics', () => {
  const getMetrics = jest.fn();

  const filters = {
    environment: {
      name: 'development',
      namespace: 'dev-ns',
      isProduction: false,
      createdAt: '2026-01-01T00:00:00Z',
    },
    timeRange: '1h',
  };

  const metricsFor = (value: number) => ({
    cpuUsage: {
      cpuUsage: [{ timestamp: '2026-03-05T10:00:00.000Z', value }],
      cpuRequests: [],
      cpuLimits: [],
    },
    memoryUsage: { memoryUsage: [], memoryRequests: [], memoryLimits: [] },
  });

  const render = (
    components: string[],
    metricType: 'resource' | 'http' = 'resource',
    enabled: boolean = true,
  ) =>
    renderHook(
      () =>
        useProjectMetrics(
          filters as any,
          components,
          'dev-ns',
          'project-a',
          metricType,
          enabled,
        ),
      { wrapper: createQueryWrapper() },
    );

  beforeEach(() => {
    jest.clearAllMocks();
    (useApi as jest.Mock).mockReturnValue({ getMetrics });
  });

  it('fans out one request per component and merges results by component name', async () => {
    getMetrics.mockImplementation((_env, componentName) =>
      Promise.resolve(metricsFor(componentName === 'api' ? 0.5 : 0.25)),
    );

    const { result } = render(['api', 'worker']);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getMetrics).toHaveBeenCalledTimes(2);
    expect(getMetrics).toHaveBeenCalledWith(
      'development',
      'api',
      'dev-ns',
      'project-a',
      expect.objectContaining({ type: 'resource' }),
    );
    expect(getMetrics).toHaveBeenCalledWith(
      'development',
      'worker',
      'dev-ns',
      'project-a',
      expect.objectContaining({ type: 'resource' }),
    );

    const metrics = result.current.metrics as ProjectResourceMetrics;
    expect(Object.keys(metrics.byComponent).sort()).toEqual(['api', 'worker']);
    expect(metrics.byComponent.api.cpuUsage.cpuUsage[0].value).toBe(0.5);
    expect(metrics.byComponent.worker.cpuUsage.cpuUsage[0].value).toBe(0.25);
    expect(metrics.failedComponents).toEqual([]);
    expect(result.current.error).toBeUndefined();
  });

  it('fires no requests when the consumer gate is false', async () => {
    render(['api'], 'resource', false);

    await waitFor(() => expect(getMetrics).not.toHaveBeenCalled());
  });

  it('fires no requests for an empty component list', async () => {
    render([]);

    await waitFor(() => expect(getMetrics).not.toHaveBeenCalled());
  });

  it('keeps the components that succeeded when one fails (partial success)', async () => {
    getMetrics.mockImplementation((_env, componentName) =>
      componentName === 'worker'
        ? Promise.reject(
            new Error('Observability is not enabled for component worker'),
          )
        : Promise.resolve(metricsFor(0.5)),
    );

    const { result } = render(['api', 'db', 'worker']);

    await waitFor(() => expect(result.current.loading).toBe(false));

    const metrics = result.current.metrics as ProjectResourceMetrics;
    expect(Object.keys(metrics.byComponent).sort()).toEqual(['api', 'db']);
    expect(metrics.failedComponents).toEqual([
      {
        name: 'worker',
        error: 'Observability is not enabled for component worker',
      },
    ]);
    // A partly-degraded fan-out is not a page-level error.
    expect(result.current.error).toBeUndefined();
  });

  it('surfaces an error when every component fails', async () => {
    getMetrics.mockRejectedValue(
      new Error('Observability is not enabled for this project'),
    );

    const { result } = render(['api', 'worker']);

    await waitFor(() =>
      expect(result.current.error).toBe(
        'Observability is not enabled for this project',
      ),
    );
    expect(result.current.metrics).toBeUndefined();
  });

  it('requests HTTP metrics when metricType is http', async () => {
    getMetrics.mockResolvedValue({
      networkThroughput: {
        requestCount: [],
        successfulRequestCount: [],
        unsuccessfulRequestCount: [],
      },
      networkLatency: {
        meanLatency: [],
        latencyP50: [],
        latencyP90: [],
        latencyP99: [],
      },
    });

    const { result } = render(['api'], 'http');

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getMetrics).toHaveBeenCalledWith(
      'development',
      'api',
      'dev-ns',
      'project-a',
      expect.objectContaining({ type: 'http' }),
    );
  });

  it('scales the step with the selected time range', async () => {
    getMetrics.mockResolvedValue(metricsFor(1));

    const stepFor = async (timeRange: string) => {
      getMetrics.mockClear();
      const { result } = renderHook(
        () =>
          useProjectMetrics(
            { ...filters, timeRange } as any,
            ['api'],
            'dev-ns',
            'project-a',
          ),
        { wrapper: createQueryWrapper() },
      );
      await waitFor(() => expect(result.current.loading).toBe(false));
      return getMetrics.mock.calls[0][4].step;
    };

    expect(await stepFor('1h')).toBe('1m');
    expect(await stepFor('24h')).toBe('5m');
    expect(await stepFor('7d')).toBe('30m');
  });

  it('refetches when the component list changes but not when it is merely reordered', async () => {
    getMetrics.mockResolvedValue(metricsFor(1));

    const { result, rerender } = renderHook(
      ({ components }: { components: string[] }) =>
        useProjectMetrics(filters as any, components, 'dev-ns', 'project-a'),
      {
        wrapper: createQueryWrapper(),
        initialProps: { components: ['api', 'worker'] },
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getMetrics).toHaveBeenCalledTimes(2);

    // Same set, different order — the query key sorts, so nothing refetches.
    rerender({ components: ['worker', 'api'] });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getMetrics).toHaveBeenCalledTimes(2);

    // A genuinely different set is a new key.
    rerender({ components: ['api', 'worker', 'db'] });
    await waitFor(() => expect(getMetrics).toHaveBeenCalledTimes(5));
  });
});
