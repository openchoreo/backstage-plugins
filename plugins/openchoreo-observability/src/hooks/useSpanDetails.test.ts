import { renderHook, waitFor, act } from '@testing-library/react';
import { useApi } from '@backstage/core-plugin-api';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { useSpanDetails } from './useSpanDetails';

jest.mock('@backstage/core-plugin-api', () => {
  const actual = jest.requireActual('@backstage/core-plugin-api');
  return {
    ...actual,
    useApi: jest.fn(),
  };
});

describe('useSpanDetails', () => {
  const getSpanDetails = jest.fn();

  const options = {
    namespaceName: 'dev',
    environmentName: 'development',
  };

  const details = {
    spanId: 'span-1',
    traceId: 'trace-1',
    name: 'GET /api',
    durationNs: 1000,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useApi as jest.Mock).mockReturnValue({ getSpanDetails });
  });

  it('starts with no cached details, no loading and no error for a span', () => {
    const { result } = renderHook(() => useSpanDetails(options), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current.getDetails('trace-1', 'span-1')).toBeUndefined();
    expect(result.current.isLoading('trace-1', 'span-1')).toBe(false);
    expect(result.current.getError('trace-1', 'span-1')).toBeUndefined();
  });

  it('flips the per-span loading flag while fetching and clears it once resolved', async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    getSpanDetails.mockReturnValueOnce(
      new Promise(resolve => {
        resolveFetch = resolve;
      }),
    );

    const { result } = renderHook(() => useSpanDetails(options), {
      wrapper: createQueryWrapper(),
    });

    act(() => {
      void result.current.fetchSpanDetails('trace-1', 'span-1');
    });

    await waitFor(() =>
      expect(result.current.isLoading('trace-1', 'span-1')).toBe(true),
    );

    await act(async () => {
      resolveFetch(details);
    });

    await waitFor(() =>
      expect(result.current.isLoading('trace-1', 'span-1')).toBe(false),
    );
  });

  it('caches the resolved span details for reads and records no error', async () => {
    getSpanDetails.mockResolvedValueOnce(details);

    const { result } = renderHook(() => useSpanDetails(options), {
      wrapper: createQueryWrapper(),
    });

    await act(async () => {
      await result.current.fetchSpanDetails('trace-1', 'span-1');
    });

    expect(getSpanDetails).toHaveBeenCalledWith(
      'trace-1',
      'span-1',
      'dev',
      'development',
    );
    await waitFor(() =>
      expect(result.current.getDetails('trace-1', 'span-1')).toEqual(details),
    );
    expect(result.current.getError('trace-1', 'span-1')).toBeUndefined();
  });

  it('records a per-span error message when the fetch rejects', async () => {
    getSpanDetails.mockRejectedValueOnce(new Error('span boom'));

    const { result } = renderHook(() => useSpanDetails(options), {
      wrapper: createQueryWrapper(),
    });

    await act(async () => {
      await result.current.fetchSpanDetails('trace-1', 'span-1');
    });

    await waitFor(() =>
      expect(result.current.getError('trace-1', 'span-1')).toBe('span boom'),
    );
    expect(result.current.isLoading('trace-1', 'span-1')).toBe(false);
  });
});
