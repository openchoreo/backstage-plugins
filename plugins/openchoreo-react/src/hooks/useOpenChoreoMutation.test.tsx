import { renderHook, waitFor, act } from '@testing-library/react';
import { ReactNode } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query';
import { useOpenChoreoMutation } from './useOpenChoreoMutation';

function freshClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function wrapperWith(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('useOpenChoreoMutation', () => {
  it('resolves with the mutation result (data-returning mutation)', async () => {
    const fn = jest.fn().mockResolvedValue({ id: 's1' });
    const { result } = renderHook(() => useOpenChoreoMutation(fn), {
      wrapper: wrapperWith(freshClient()),
    });

    let returned: unknown;
    await act(async () => {
      returned = await result.current.mutate('arg1', 42);
    });

    expect(fn).toHaveBeenCalledWith('arg1', 42);
    expect(returned).toEqual({ id: 's1' });
    expect(result.current.error).toBeNull();
  });

  it('resolves with void for a void mutation', async () => {
    const fn = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useOpenChoreoMutation(fn), {
      wrapper: wrapperWith(freshClient()),
    });

    let returned: unknown = 'sentinel';
    await act(async () => {
      returned = await result.current.mutate('x');
    });

    expect(returned).toBeUndefined();
  });

  it('re-throws on failure and records the error', async () => {
    const boom = new Error('nope');
    const fn = jest.fn().mockRejectedValue(boom);
    const { result } = renderHook(() => useOpenChoreoMutation(fn), {
      wrapper: wrapperWith(freshClient()),
    });

    await act(async () => {
      await expect(result.current.mutate('x')).rejects.toBe(boom);
    });

    await waitFor(() => expect(result.current.error).toBe(boom));
  });

  it('invalidates the given query keys after success', async () => {
    const client = freshClient();
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce('v1')
      .mockResolvedValueOnce('v2');

    // A query we expect to be refetched by the mutation's invalidation.
    const { result: query } = renderHook(
      () => useQuery({ queryKey: ['thing'], queryFn: fetcher }),
      { wrapper: wrapperWith(client) },
    );
    await waitFor(() => expect(query.current.data).toBe('v1'));

    const fn = jest.fn().mockResolvedValue(undefined);
    const { result: mut } = renderHook(
      () => useOpenChoreoMutation(fn, { invalidates: [['thing']] }),
      { wrapper: wrapperWith(client) },
    );

    await act(async () => {
      await mut.current.mutate();
    });

    // Invalidation re-ran the query fetcher → data advances to v2.
    await waitFor(() => expect(query.current.data).toBe('v2'));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('calls onSuccess with the result and args', async () => {
    const onSuccess = jest.fn();
    const fn = jest.fn().mockResolvedValue('done');
    const { result } = renderHook(
      () => useOpenChoreoMutation(fn, { onSuccess }),
      { wrapper: wrapperWith(freshClient()) },
    );

    await act(async () => {
      await result.current.mutate('a', 'b');
    });

    expect(onSuccess).toHaveBeenCalledWith('done', ['a', 'b']);
  });

  it('calls onError with the error and args on failure', async () => {
    const onError = jest.fn();
    const boom = new Error('bad');
    const fn = jest.fn().mockRejectedValue(boom);
    const { result } = renderHook(
      () => useOpenChoreoMutation(fn, { onError }),
      { wrapper: wrapperWith(freshClient()) },
    );

    await act(async () => {
      await expect(result.current.mutate('z')).rejects.toBe(boom);
    });

    await waitFor(() => expect(onError).toHaveBeenCalledWith(boom, ['z']));
  });
});
