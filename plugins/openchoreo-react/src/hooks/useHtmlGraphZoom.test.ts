import { act, renderHook } from '@testing-library/react';
import { useHtmlGraphZoom } from './useHtmlGraphZoom';

class ResizeObserverMock {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}

beforeAll(() => {
  // jsdom doesn't ship ResizeObserver
  (
    global as unknown as { ResizeObserver: typeof ResizeObserverMock }
  ).ResizeObserver = ResizeObserverMock;
});

describe('useHtmlGraphZoom', () => {
  it('returns the expected ref / state / control surface', () => {
    const { result } = renderHook(() =>
      useHtmlGraphZoom({ contentWidth: 400, contentHeight: 300 }),
    );

    expect(typeof result.current.containerRef).toBe('function');
    expect(typeof result.current.contentRef).toBe('function');
    expect(typeof result.current.zoomIn).toBe('function');
    expect(typeof result.current.zoomOut).toBe('function');
    expect(typeof result.current.fitToView).toBe('function');
    expect(typeof result.current.panTo).toBe('function');
    expect(result.current.transform).toEqual({ x: 0, y: 0, k: 1 });
    expect(result.current.viewBox).toEqual({ width: 400, height: 300 });
  });

  it('applies the current transform to the content element', () => {
    const { result } = renderHook(() =>
      useHtmlGraphZoom({ contentWidth: 100, contentHeight: 100 }),
    );

    const contentEl = document.createElement('div');
    act(() => {
      result.current.contentRef(contentEl);
    });

    expect(contentEl.style.transformOrigin).toBe('0 0');
    expect(contentEl.style.transform).toBe('translate(0px, 0px) scale(1)');
  });
});
