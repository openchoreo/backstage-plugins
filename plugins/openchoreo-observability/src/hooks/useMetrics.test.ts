import { renderHook, waitFor } from '@testing-library/react';
import { useApi } from '@backstage/core-plugin-api';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { useMetrics } from './useMetrics';

jest.mock('@backstage/core-plugin-api', () => {
  const actual = jest.requireActual('@backstage/core-plugin-api');
  return {
    ...actual,
    useApi: jest.fn(),
  };
});

describe('useMetrics', () => {
  const getMetrics = jest.fn();

  const componentEntity = {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'component-a',
      annotations: {
        'openchoreo.io/namespace': 'dev',
        'openchoreo.io/component': 'component-a',
      },
    },
    spec: { owner: 'group:default/team' },
  };

  // A Project entity has no component annotation — this is how the project
  // Metrics tab asks for the project-wide aggregate.
  const projectEntity = {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'System',
    metadata: {
      name: 'project-a',
      annotations: { 'openchoreo.io/namespace': 'dev' },
    },
    spec: { owner: 'group:default/team' },
  };

  const filters = {
    environment: {
      name: 'development',
      namespace: 'dev',
      isProduction: false,
      createdAt: '2026-01-01T00:00:00Z',
    },
    timeRange: '1h',
  };

  const resourceMetrics = {
    cpu: [{ timestamp: '2026-03-05T10:00:00.000Z', value: 0.5 }],
    memory: [{ timestamp: '2026-03-05T10:00:00.000Z', value: 128 }],
  };

  const render = (
    entity: unknown,
    metricType: 'resource' | 'http' = 'resource',
    enabled: boolean = true,
  ) =>
    renderHook(
      () =>
        useMetrics(
          filters as any,
          entity as any,
          'dev',
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

  it('starts in loading state with null data', () => {
    getMetrics.mockReturnValue(new Promise(() => {}));

    const { result } = render(componentEntity);

    expect(result.current.loading).toBe(true);
    expect(result.current.metrics).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('resolves the metrics and clears loading/error once settled', async () => {
    getMetrics.mockResolvedValueOnce(resourceMetrics);

    const { result } = render(componentEntity);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getMetrics).toHaveBeenCalledWith(
      'development',
      'component-a',
      'dev',
      'project-a',
      expect.objectContaining({ type: 'resource' }),
    );
    expect(result.current.metrics).toEqual(resourceMetrics);
    expect(result.current.error).toBeNull();
  });

  it('sends the full option set derived from the time range', async () => {
    getMetrics.mockResolvedValueOnce(resourceMetrics);

    const { result } = render(componentEntity);

    await waitFor(() => expect(result.current.loading).toBe(false));

    const options = getMetrics.mock.calls[0][4];
    expect(options).toEqual({
      startTime: expect.any(String),
      endTime: expect.any(String),
      step: '1m',
      type: 'resource',
    });
    // A 1h range must produce a 1h window, not the API's own default.
    const spanMs =
      new Date(options.endTime).getTime() -
      new Date(options.startTime).getTime();
    expect(spanMs).toBeCloseTo(60 * 60 * 1000, -4);
  });

  it('still fires for a project entity, omitting the component', async () => {
    getMetrics.mockResolvedValueOnce(resourceMetrics);

    const { result } = render(projectEntity);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getMetrics).toHaveBeenCalledTimes(1);
    expect(getMetrics).toHaveBeenCalledWith(
      'development',
      undefined,
      'dev',
      'project-a',
      expect.objectContaining({ type: 'resource' }),
    );
    expect(result.current.metrics).toEqual(resourceMetrics);
  });

  it('fires no request while the consumer gate is closed', async () => {
    render(projectEntity, 'resource', false);

    await waitFor(() => expect(getMetrics).not.toHaveBeenCalled());
  });

  it('carries the http metric type through to the request', async () => {
    getMetrics.mockResolvedValueOnce({});

    const { result } = render(componentEntity, 'http');

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getMetrics).toHaveBeenCalledWith(
      'development',
      'component-a',
      'dev',
      'project-a',
      expect.objectContaining({ type: 'http' }),
    );
  });

  it('maps a rejected request to the error string', async () => {
    getMetrics.mockRejectedValueOnce(
      new Error('Observability is not enabled for this component'),
    );

    const { result } = render(componentEntity);

    await waitFor(() =>
      expect(result.current.error).toBe(
        'Observability is not enabled for this component',
      ),
    );
    expect(result.current.metrics).toBeNull();
  });

  it('exposes isRefetching, false once the load settles', async () => {
    getMetrics.mockResolvedValueOnce(resourceMetrics);

    const { result } = render(componentEntity);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isRefetching).toBe(false);
  });
});
