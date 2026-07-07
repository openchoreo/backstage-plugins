import { render, screen, fireEvent } from '@testing-library/react';
import { ContentLoader } from './ContentLoader';

type Data = { items: string[] };

const renderContent = (d: Data) => (
  <div data-testid="content">{d.items.join(',')}</div>
);

describe('ContentLoader', () => {
  it('shows the skeleton on first load (loading, no data)', () => {
    const { container } = render(
      <ContentLoader<Data> loading data={null}>
        {renderContent}
      </ContentLoader>,
    );
    expect(screen.queryByTestId('content')).not.toBeInTheDocument();
    // Default skeleton renders decorative placeholder nodes.
    expect(
      container.querySelectorAll('[aria-hidden="true"]').length,
    ).toBeGreaterThan(0);
  });

  it('shows an error state (with retry) when there is no data', () => {
    const onRetry = jest.fn();
    render(
      <ContentLoader<Data>
        loading={false}
        error={new Error('boom')}
        data={null}
        onRetry={onRetry}
      >
        {renderContent}
      </ContentLoader>,
    );
    expect(screen.getByText('boom')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows the empty state when data is present but empty', () => {
    render(
      <ContentLoader<Data>
        loading={false}
        data={{ items: [] }}
        isEmpty={d => d.items.length === 0}
      >
        {renderContent}
      </ContentLoader>,
    );
    expect(screen.getByText('No data available')).toBeInTheDocument();
    expect(screen.queryByTestId('content')).not.toBeInTheDocument();
  });

  it('shows the skeleton (not the empty state) on a first load with data=[]', () => {
    // Hooks that init data to `[]` report "present but empty" from render 1.
    // A first load must still show the skeleton, not a flash of "No data".
    const { container } = render(
      <ContentLoader<Data>
        loading
        data={{ items: [] }}
        isEmpty={d => d.items.length === 0}
      >
        {renderContent}
      </ContentLoader>,
    );
    expect(screen.queryByText('No data available')).not.toBeInTheDocument();
    expect(
      container.querySelectorAll('[aria-hidden="true"]').length,
    ).toBeGreaterThan(0);
  });

  it('renders content when data is present', () => {
    render(
      <ContentLoader<Data> loading={false} data={{ items: ['a', 'b'] }}>
        {renderContent}
      </ContentLoader>,
    );
    expect(screen.getByTestId('content')).toHaveTextContent('a,b');
  });

  // The regression guard: a slow refetch must NOT tear down populated content.
  it('keeps content mounted and overlays a spinner while refetching', () => {
    render(
      <ContentLoader<Data>
        loading={false}
        isRefetching
        data={{ items: ['a', 'b'] }}
      >
        {renderContent}
      </ContentLoader>,
    );
    // Content stays on screen...
    expect(screen.getByTestId('content')).toHaveTextContent('a,b');
    // ...with an overlay spinner and aria-busy signalling the refresh.
    expect(screen.getByTestId('refetch-overlay')).toBeInTheDocument();
    expect(screen.getByLabelText('Refreshing')).toBeInTheDocument();
  });

  // Even if a hook incorrectly sets loading=true on refetch, existing data wins.
  it('does not fall back to the skeleton when loading=true but data exists', () => {
    render(
      <ContentLoader<Data> loading isRefetching data={{ items: ['x'] }}>
        {renderContent}
      </ContentLoader>,
    );
    expect(screen.getByTestId('content')).toHaveTextContent('x');
    expect(screen.getByTestId('refetch-overlay')).toBeInTheDocument();
  });

  it('prefers showing stale data over an error during refetch', () => {
    render(
      <ContentLoader<Data>
        loading={false}
        isRefetching
        error={new Error('transient')}
        data={{ items: ['cached'] }}
      >
        {renderContent}
      </ContentLoader>,
    );
    expect(screen.getByTestId('content')).toHaveTextContent('cached');
    expect(screen.queryByText('transient')).not.toBeInTheDocument();
  });
});
