import { render, screen } from '@testing-library/react';
import { VirtualizedLogList } from './VirtualizedLogList';

// @tanstack/react-virtual needs real DOM layout (which jsdom lacks) to decide
// what to render, so mock useVirtualizer with a simple stand-in that returns
// every item. The tests then verify how VirtualizedLogList wires its inputs
// to the virtualizer; real windowing is the library's concern.
const mockScrollToIndex = jest.fn();
let mockVirtualizerArgs: any;
jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (args: any) => {
    mockVirtualizerArgs = args;
    const items = Array.from({ length: args.count }).map((_, index) => ({
      index,
      key: args.getItemKey ? args.getItemKey(index) : index,
      start: 0,
      size: 28,
    }));
    return {
      getVirtualItems: () => items,
      getTotalSize: () => args.count * 28,
      measureElement: () => {},
      scrollToIndex: mockScrollToIndex,
    };
  },
}));

describe('VirtualizedLogList', () => {
  beforeEach(() => {
    mockScrollToIndex.mockClear();
    mockVirtualizerArgs = undefined;
  });

  it('renders rows via the renderRow prop', () => {
    render(
      <VirtualizedLogList
        itemCount={3}
        renderRow={index => <span>line-{index}</span>}
      />,
    );

    expect(screen.getByText('line-0')).toBeInTheDocument();
    expect(screen.getByText('line-2')).toBeInTheDocument();
  });

  it('passes the estimated row height to the virtualizer', () => {
    render(
      <VirtualizedLogList
        itemCount={5}
        estimatedRowHeight={20}
        renderRow={() => null}
      />,
    );

    expect(mockVirtualizerArgs.estimateSize()).toBe(20);
  });

  it('calls onReachEnd when the end is reached and hasMore is true', () => {
    const onReachEnd = jest.fn();

    render(
      <VirtualizedLogList
        itemCount={3}
        hasMore
        loading={false}
        onReachEnd={onReachEnd}
        renderRow={() => null}
      />,
    );

    expect(onReachEnd).toHaveBeenCalledTimes(1);
  });

  it('does not call onReachEnd while loading', () => {
    const onReachEnd = jest.fn();

    render(
      <VirtualizedLogList
        itemCount={3}
        hasMore
        loading
        onReachEnd={onReachEnd}
        renderRow={() => null}
      />,
    );

    expect(onReachEnd).not.toHaveBeenCalled();
  });

  it('does not re-fire onReachEnd if a load returns no new rows', () => {
    // Regression: if the server keeps responding hasMore=true with the same
    // itemCount, we must not loop. The pending guard only resets when the
    // count actually grows.
    const onReachEnd = jest.fn();
    const { rerender } = render(
      <VirtualizedLogList
        itemCount={3}
        hasMore
        loading={false}
        onReachEnd={onReachEnd}
        renderRow={() => null}
      />,
    );
    expect(onReachEnd).toHaveBeenCalledTimes(1);

    rerender(
      <VirtualizedLogList
        itemCount={3}
        hasMore
        loading
        onReachEnd={onReachEnd}
        renderRow={() => null}
      />,
    );
    rerender(
      <VirtualizedLogList
        itemCount={3}
        hasMore
        loading={false}
        onReachEnd={onReachEnd}
        renderRow={() => null}
      />,
    );

    expect(onReachEnd).toHaveBeenCalledTimes(1);
  });

  it('re-fires onReachEnd after itemCount grows', () => {
    const onReachEnd = jest.fn();
    const { rerender } = render(
      <VirtualizedLogList
        itemCount={3}
        hasMore
        loading={false}
        onReachEnd={onReachEnd}
        renderRow={() => null}
      />,
    );
    expect(onReachEnd).toHaveBeenCalledTimes(1);

    rerender(
      <VirtualizedLogList
        itemCount={3}
        hasMore
        loading
        onReachEnd={onReachEnd}
        renderRow={() => null}
      />,
    );
    rerender(
      <VirtualizedLogList
        itemCount={10}
        hasMore
        loading={false}
        onReachEnd={onReachEnd}
        renderRow={() => null}
      />,
    );

    expect(onReachEnd).toHaveBeenCalledTimes(2);
  });

  it('does not call onReachEnd when there is nothing more to load', () => {
    const onReachEnd = jest.fn();

    render(
      <VirtualizedLogList
        itemCount={3}
        hasMore={false}
        onReachEnd={onReachEnd}
        renderRow={() => null}
      />,
    );

    expect(onReachEnd).not.toHaveBeenCalled();
  });

  it('always passes a getItemKey function, defaulting to the index', () => {
    // Regression guard: passing `undefined` for an always-called callback would
    // overwrite the default and crash the underlying library (the bug we hit
    // with virtuoso). Even without a caller-supplied getItemKey, we must hand
    // the virtualizer a real function that returns the index.
    render(
      <VirtualizedLogList
        itemCount={3}
        renderRow={index => <span>line-{index}</span>}
      />,
    );

    expect(typeof mockVirtualizerArgs.getItemKey).toBe('function');
    expect(mockVirtualizerArgs.getItemKey(2)).toBe(2);
  });

  it('uses getItemKey for item keys when provided', () => {
    const getItemKey = jest.fn((index: number) => `k-${index}`);

    render(
      <VirtualizedLogList
        itemCount={2}
        getItemKey={getItemKey}
        renderRow={() => null}
      />,
    );

    expect(mockVirtualizerArgs.getItemKey(1)).toBe('k-1');
  });

  it('scrolls to the newest row on first mount when followTail is set with existing items', () => {
    // Regression: opening a live stream that already has buffered rows must
    // jump to the tail; otherwise the user is stranded at the top of an
    // already-populated list until the next item arrives.
    render(
      <VirtualizedLogList itemCount={5} followTail renderRow={() => null} />,
    );

    expect(mockScrollToIndex).toHaveBeenCalledWith(4, { align: 'end' });
  });

  it('does not scroll to the tail on mount when followTail is false', () => {
    render(<VirtualizedLogList itemCount={5} renderRow={() => null} />);

    expect(mockScrollToIndex).not.toHaveBeenCalled();
  });

  it('scrolls when the last item key changes even when itemCount stays the same', () => {
    // Regression: mimics streaming buffers (Wirelogs cap-shift, dedupe,
    // replace-by-uuid) where the length is constant but the tail row's
    // identity changes. Follow-tail should still engage.
    const { rerender } = render(
      <VirtualizedLogList
        itemCount={3}
        followTail
        getItemKey={index => (index === 2 ? 'old-tail' : `static-${index}`)}
        renderRow={() => null}
      />,
    );
    mockScrollToIndex.mockClear();

    rerender(
      <VirtualizedLogList
        itemCount={3}
        followTail
        getItemKey={index => (index === 2 ? 'new-tail' : `static-${index}`)}
        renderRow={() => null}
      />,
    );

    expect(mockScrollToIndex).toHaveBeenCalledWith(2, { align: 'end' });
  });

  it('scrolls to the newest row on append when followTail is set', () => {
    const { rerender } = render(
      <VirtualizedLogList itemCount={3} followTail renderRow={() => null} />,
    );
    mockScrollToIndex.mockClear();

    rerender(
      <VirtualizedLogList itemCount={5} followTail renderRow={() => null} />,
    );

    expect(mockScrollToIndex).toHaveBeenCalledWith(4, { align: 'end' });
  });

  it('renders the header slot when provided', () => {
    // Regression guard: the header must render *inside* the scroll container
    // so it shares the rows' content width (no scrollbar-gutter drift).
    render(
      <VirtualizedLogList
        itemCount={3}
        header={<span>header-content</span>}
        renderRow={() => null}
      />,
    );

    expect(screen.getByText('header-content')).toBeInTheDocument();
  });

  it('renders the footer slot when provided', () => {
    render(
      <VirtualizedLogList
        itemCount={3}
        footer={<span>footer-content</span>}
        renderRow={() => null}
      />,
    );

    expect(screen.getByText('footer-content')).toBeInTheDocument();
  });
});
