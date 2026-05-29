import { render, screen } from '@testing-library/react';
import { WirelogsStats } from './WirelogsStats';

describe('WirelogsStats', () => {
  it('renders the counts and a 0% ratio when there are no flows', () => {
    render(
      <WirelogsStats
        visibleCount={0}
        totalLoaded={0}
        allowed={0}
        dropped={0}
      />,
    );
    expect(screen.getByText(/Showing/)).toBeInTheDocument();
    expect(screen.getByText(/0% Degraded/)).toBeInTheDocument();
  });

  it('labels ratios at or above 90% as Success (high)', () => {
    render(
      <WirelogsStats
        visibleCount={100}
        totalLoaded={100}
        allowed={90}
        dropped={10}
      />,
    );
    expect(screen.getByText(/90% Success/)).toBeInTheDocument();
  });

  it('labels ratios between 70% and 89% as Success (mid)', () => {
    render(
      <WirelogsStats
        visibleCount={10}
        totalLoaded={10}
        allowed={7}
        dropped={3}
      />,
    );
    expect(screen.getByText(/70% Success/)).toBeInTheDocument();
  });

  it('labels ratios below 70% as Degraded (low)', () => {
    render(
      <WirelogsStats
        visibleCount={10}
        totalLoaded={10}
        allowed={5}
        dropped={5}
      />,
    );
    expect(screen.getByText(/50% Degraded/)).toBeInTheDocument();
  });

  it('renders the allowed and dropped counts in their own cells', () => {
    render(
      <WirelogsStats
        visibleCount={20}
        totalLoaded={30}
        allowed={15}
        dropped={5}
      />,
    );
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
  });
});
