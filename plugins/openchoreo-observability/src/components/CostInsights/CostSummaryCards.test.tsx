import { render, screen } from '@testing-library/react';
import { CostSummaryCards } from './CostSummaryCards';
import type { CostSummary } from './types';

const summary = (over: Partial<CostSummary> = {}): CostSummary => ({
  totalCost: 22,
  deltaPct: 10,
  forecastThisMonth: 500,
  efficiency: 0.3,
  ...over,
});

describe('CostSummaryCards', () => {
  it('renders the total, forecast and efficiency headlines', () => {
    render(<CostSummaryCards summary={summary()} />);
    expect(screen.getByText('Total Cost')).toBeInTheDocument();
    expect(screen.getByText('USD 22.00')).toBeInTheDocument();
    expect(screen.getByText('Forecast this month')).toBeInTheDocument();
    expect(screen.getByText('USD 500.00')).toBeInTheDocument();
    expect(screen.getByText('Efficiency')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
  });

  it('shows an upward delta chip against the previous window', () => {
    render(<CostSummaryCards summary={summary({ deltaPct: 10 })} />);
    expect(screen.getByText('10% vs prev window')).toBeInTheDocument();
  });

  it('shows a downward delta with its magnitude only', () => {
    render(<CostSummaryCards summary={summary({ deltaPct: -8 })} />);
    expect(screen.getByText('8% vs prev window')).toBeInTheDocument();
  });

  it('falls back to a "No previous window" note when the delta is unknown', () => {
    render(<CostSummaryCards summary={summary({ deltaPct: null })} />);
    expect(screen.getByText('No previous window')).toBeInTheDocument();
  });
});
