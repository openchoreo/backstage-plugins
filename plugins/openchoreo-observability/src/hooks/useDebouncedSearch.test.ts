import { act, renderHook } from '@testing-library/react';
import { useDebouncedSearch } from './useDebouncedSearch';

describe('useDebouncedSearch', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('reports typing only after the debounce', () => {
    const onChange = jest.fn();
    const { result } = renderHook(() => useDebouncedSearch('', onChange, 1000));

    act(() => {
      result.current[1]({
        target: { value: 'reconcile' },
      } as React.ChangeEvent<HTMLInputElement>);
    });
    expect(onChange).not.toHaveBeenCalledWith('reconcile');

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(onChange).toHaveBeenCalledWith('reconcile');
  });

  // A clear button that took a second to take effect would read as broken.
  it('clears immediately, without waiting for the debounce', () => {
    const onChange = jest.fn();
    const { result } = renderHook(() =>
      useDebouncedSearch('plane=controlplane', onChange, 1000),
    );

    act(() => {
      result.current[2]();
    });

    expect(onChange).toHaveBeenCalledWith('');
    expect(result.current[0]).toBe('');
  });

  // Clearing mid-type must not be undone when the earlier timer fires.
  it('does not resurrect a value cleared while typing was pending', () => {
    const onChange = jest.fn();
    const { result } = renderHook(() => useDebouncedSearch('', onChange, 1000));

    act(() => {
      result.current[1]({
        target: { value: 'abc' },
      } as React.ChangeEvent<HTMLInputElement>);
    });
    act(() => {
      result.current[2]();
    });
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(onChange).not.toHaveBeenCalledWith('abc');
    expect(result.current[0]).toBe('');
  });
});
