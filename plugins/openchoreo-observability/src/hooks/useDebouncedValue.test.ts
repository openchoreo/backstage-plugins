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
  //
  // "At once" means in the same render, not on the next one: a caller may clear this as
  // it switches to asking about something else, and a single render still reporting the
  // old text is enough to ask the new question with it.
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

  it('reports a clear without waiting for a re-render', () => {
    let seen: string[] = [];
    const { rerender } = renderHook(
      ({ value }) => {
        seen.push(useDebouncedValue(value, 300));
        return null;
      },
      { initialProps: { value: 'cert' } },
    );

    act(() => {
      jest.advanceTimersByTime(300);
    });
    seen = [];

    rerender({ value: '' });

    // Every render after the clear sees it, the first one included.
    expect(seen).not.toHaveLength(0);
    expect(seen).toEqual(seen.map(() => ''));
  });

  // Typing again straight after a clear must debounce from empty, not from what stood
  // there before - otherwise the old text comes back for a moment.
  it('does not resurrect the previous value when typing after a clear', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 300),
      { initialProps: { value: 'cert' } },
    );

    act(() => {
      jest.advanceTimersByTime(300);
    });
    rerender({ value: '' });
    rerender({ value: 'x' });

    expect(result.current).toBe('');
  });
});
