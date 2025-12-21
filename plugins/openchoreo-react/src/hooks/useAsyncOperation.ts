import { useState, useCallback } from 'react';

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

export type AsyncState<T> =
  | { status: 'idle'; data: null; error: null }
  | { status: 'loading'; data: null; error: null }
  | { status: 'success'; data: T; error: null }
  | { status: 'error'; data: null; error: Error };

/**
 * Hook for managing async operation state (loading, success, error).
 * Provides a clean way to track the state of async operations.
 *
 * @example
 * const saveOperation = useAsyncOperation(async (data: FormData) => {
 *   const result = await api.save(data);
 *   return result;
 * });
 *
 * // Execute the operation
 * const handleSave = async () => {
 *   try {
 *     const result = await saveOperation.execute(formData);
 *     console.log('Saved:', result);
 *   } catch (err) {
 *     // Error is also available via saveOperation.error
 *   }
 * };
 *
 * // In JSX
 * <Button disabled={saveOperation.isLoading}>
 *   {saveOperation.isLoading ? 'Saving...' : 'Save'}
 * </Button>
 * {saveOperation.error && <ErrorMessage error={saveOperation.error} />}
 */
export function useAsyncOperation<T, Args extends unknown[]>(
  operation: (...args: Args) => Promise<T>,
) {
  const [state, setState] = useState<AsyncState<T>>({
    status: 'idle',
    data: null,
    error: null,
  });

  const execute = useCallback(
    async (...args: Args): Promise<T> => {
      setState({ status: 'loading', data: null, error: null });
      try {
        const data = await operation(...args);
        setState({ status: 'success', data, error: null });
        return data;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        setState({ status: 'error', data: null, error: err });
        throw err;
      }
    },
    [operation],
  );

  const reset = useCallback(() => {
    setState({ status: 'idle', data: null, error: null });
  }, []);

  return {
    /** Current status: 'idle' | 'loading' | 'success' | 'error' */
    status: state.status,
    /** Result data (only available when status is 'success') */
    data: state.data,
    /** Error (only available when status is 'error') */
    error: state.error,
    /** Convenience boolean for checking loading state */
    isLoading: state.status === 'loading',
    /** Convenience boolean for checking if operation completed successfully */
    isSuccess: state.status === 'success',
    /** Convenience boolean for checking error state */
    isError: state.status === 'error',
    /** Execute the operation */
    execute,
    /** Reset to idle state */
    reset,
  };
}
