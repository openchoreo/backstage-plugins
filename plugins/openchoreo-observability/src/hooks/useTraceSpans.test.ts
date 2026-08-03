import { renderHook, waitFor, act } from '@testing-library/react';
import { useApi } from '@backstage/core-plugin-api';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { useTraceSpans } from './useTraceSpans';

jest.mock('@backstage/core-plugin-api', () => {
  const actual = jest.requireActual('@backstage/core-plugin-api');
  return {
    ...actual,
    useApi: jest.fn(),
  };
});

describe('useTraceSpans', () => {
  const getTraceSpans = jest.fn();

  const options = {
    namespaceName: 'dev',
    projectName: 'project-a',
    environmentName: 'development',
  };

  const spans = [
    { spanId: 'span-1', traceId: 'trace-1', name: 'root', durationNs: 1000 },
    { spanId: 'span-2', traceId: 'trace-1', name: 'child', durationNs: 500 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (useApi as jest.Mock).mockReturnValue({ getTraceSpans });
  });

  it('starts with no cached spans, no loading and no error for a trace', () => {
    const { result } = renderHook(() => useTraceSpans(options), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current.getSpans('trace-1')).toBeUndefined();
    expect(result.current.isLoading('trace-1')).toBe(false);
    expect(result.current.getError('trace-1')).toBeUndefined();
  });

  it('flips the per-trace loading flag while fetching and clears it once resolved', async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    getTraceSpans.mockReturnValueOnce(
      new Promise(resolve => {
        resolveFetch = resolve;
      }),
    );

    const { result } = renderHook(() => useTraceSpans(options), {
      wrapper: createQueryWrapper(),
    });

    act(() => {
      void result.current.fetchSpans('trace-1');
    });

    await waitFor(() => expect(result.current.isLoading('trace-1')).toBe(true));

    await act(async () => {
      resolveFetch({ spans });
    });

    await waitFor(() =>
      expect(result.current.isLoading('trace-1')).toBe(false),
    );
  });

  it('caches the resolved spans for reads and records no error', async () => {
    getTraceSpans.mockResolvedValueOnce({ spans });

    const { result } = renderHook(() => useTraceSpans(options), {
      wrapper: createQueryWrapper(),
    });

    await act(async () => {
      await result.current.fetchSpans('trace-1');
    });

    expect(getTraceSpans).toHaveBeenCalledWith(
      'trace-1',
      'dev',
      'project-a',
      'development',
      undefined,
      expect.any(Object),
    );
    await waitFor(() =>
      expect(result.current.getSpans('trace-1')).toEqual(spans),
    );
    expect(result.current.getError('trace-1')).toBeUndefined();
  });

  it('records a per-trace error message when the fetch rejects', async () => {
    getTraceSpans.mockRejectedValueOnce(new Error('spans boom'));

    const { result } = renderHook(() => useTraceSpans(options), {
      wrapper: createQueryWrapper(),
    });

    await act(async () => {
      await result.current.fetchSpans('trace-1');
    });

    await waitFor(() =>
      expect(result.current.getError('trace-1')).toBe('spans boom'),
    );
    expect(result.current.isLoading('trace-1')).toBe(false);
  });

  it('drops cached spans on clearSpans so a re-expand refetches', async () => {
    getTraceSpans.mockResolvedValue({ spans });

    const { result } = renderHook(() => useTraceSpans(options), {
      wrapper: createQueryWrapper(),
    });

    await act(async () => {
      await result.current.fetchSpans('trace-1');
    });
    await waitFor(() =>
      expect(result.current.getSpans('trace-1')).toEqual(spans),
    );

    act(() => {
      result.current.clearSpans('trace-1');
    });
    expect(result.current.getSpans('trace-1')).toBeUndefined();
  });
});
