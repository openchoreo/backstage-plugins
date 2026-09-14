import { act, renderHook } from '@testing-library/react';
import { useDebouncedValue } from './useDebouncedValue';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('useDebouncedValue', () => {
  it('starts with the value it was given', () => {
    const { result } = renderHook(() => useDebouncedValue('cert', 300));

    expect(result.current).toBe('cert');
  });

  it('waits for the value to settle before following it', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: '' } },
    );

    rerender({ value: 'c' });
    rerender({ value: 'ce' });
    rerender({ value: 'cert' });
    expect(result.current).toBe('');

    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(result.current).toBe('cert');
  });

  // Clearing a field is deliberate, and the wider result it asks for is the one already
  // on screen - making someone wait for it reads as the control being stuck.
  it('follows a cleared value at once', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: 'cert' } },
    );

    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(result.current).toBe('cert');

    rerender({ value: '' });
    expect(result.current).toBe('');
  });
});
