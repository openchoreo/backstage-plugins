import { render, screen } from '@testing-library/react';
import { SummaryWidgetWrapper } from './SummaryWidgetWrapper';

const metrics = [
  { label: 'Running', value: 3 },
  { label: 'Failed', value: 1 },
];

describe('SummaryWidgetWrapper', () => {
  it('renders the title and metric rows in the loaded state', () => {
    render(
      <SummaryWidgetWrapper
        icon={<span data-testid="icon" />}
        title="Deployments"
        metrics={metrics}
      />,
    );

    expect(screen.getByText('Deployments')).toBeInTheDocument();
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders skeletons and no metric values while loading', () => {
    const { container } = render(
      <SummaryWidgetWrapper
        icon={<span />}
        title="Deployments"
        metrics={metrics}
        loading
      />,
    );

    // Title still renders; metric values do not.
    expect(screen.getByText('Deployments')).toBeInTheDocument();
    expect(screen.queryByText('Running')).not.toBeInTheDocument();
    // MUI Skeletons carry the MuiSkeleton class.
    expect(container.querySelectorAll('.MuiSkeleton-root').length).toBe(3);
  });

  it('renders the error message instead of metrics when errorMessage is set', () => {
    render(
      <SummaryWidgetWrapper
        icon={<span />}
        title="Deployments"
        metrics={metrics}
        errorMessage="Failed to load"
      />,
    );

    expect(screen.getByText('Failed to load')).toBeInTheDocument();
    expect(screen.queryByText('Running')).not.toBeInTheDocument();
  });

  it('shows the refresh indicator when refreshing (content already on screen)', () => {
    render(
      <SummaryWidgetWrapper
        icon={<span />}
        title="Deployments"
        metrics={metrics}
        refreshing
      />,
    );

    // RefreshOverlay renders a role="status" with the "Refreshing" label.
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Refreshing',
    );
    // Metrics remain visible underneath the overlay.
    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('does not show the refresh indicator when not refreshing', () => {
    render(
      <SummaryWidgetWrapper
        icon={<span />}
        title="Deployments"
        metrics={metrics}
      />,
    );

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('suppresses the refresh indicator during the first load', () => {
    render(
      <SummaryWidgetWrapper
        icon={<span />}
        title="Deployments"
        metrics={metrics}
        loading
        refreshing
      />,
    );

    // loading owns the whole card; the refresh overlay stays hidden.
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('suppresses the refresh indicator when an error is shown', () => {
    render(
      <SummaryWidgetWrapper
        icon={<span />}
        title="Deployments"
        metrics={metrics}
        errorMessage="Failed to load"
        refreshing
      />,
    );

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders metric cards in the "cards" variant', () => {
    render(
      <SummaryWidgetWrapper
        icon={<span />}
        title="Deployments"
        metrics={metrics}
        variant="cards"
      />,
    );

    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
