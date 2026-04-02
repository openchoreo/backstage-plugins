import { renderHook, act } from '@testing-library/react';
import { useAsyncOperation } from './useAsyncOperation';

describe('useAsyncOperation', () => {
  it('starts in idle state', () => {
    const { result } = renderHook(() =>
      useAsyncOperation(async () => 'result'),
    );

    expect(result.current.status).toBe('idle');
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it('transitions to loading then success on resolve', async () => {
    const op = jest.fn().mockResolvedValue('hello');
    const { result } = renderHook(() => useAsyncOperation(op));

    let promise: Promise<unknown>;
    act(() => {
      promise = result.current.execute();
    });

    expect(result.current.status).toBe('loading');
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      await promise!;
    });

    expect(result.current.status).toBe('success');
    expect(result.current.data).toBe('hello');
    expect(result.current.isSuccess).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it('transitions to loading then error on reject', async () => {
    const op = jest.fn().mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useAsyncOperation(op));

    await act(async () => {
      await result.current.execute().catch(() => {});
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error?.message).toBe('fail');
    expect(result.current.isError).toBe(true);
    expect(result.current.data).toBeNull();
  });

  it('wraps non-Error thrown values into Error', async () => {
    const op = jest.fn().mockRejectedValue('string error');
    const { result } = renderHook(() => useAsyncOperation(op));

    await act(async () => {
      await result.current.execute().catch(() => {});
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('string error');
  });

  it('re-throws the error from execute', async () => {
    const op = jest.fn().mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useAsyncOperation(op));

    await expect(
      act(async () => {
        await result.current.execute();
      }),
    ).rejects.toThrow('boom');
  });

  it('resets to idle state', async () => {
    const op = jest.fn().mockResolvedValue('data');
    const { result } = renderHook(() => useAsyncOperation(op));

    await act(async () => {
      await result.current.execute();
    });
    expect(result.current.status).toBe('success');

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('passes arguments through to operation', async () => {
    const op = jest.fn().mockResolvedValue('ok');
    const { result } = renderHook(() => useAsyncOperation(op));

    await act(async () => {
      await result.current.execute('arg1', 42);
    });

    expect(op).toHaveBeenCalledWith('arg1', 42);
  });
});
