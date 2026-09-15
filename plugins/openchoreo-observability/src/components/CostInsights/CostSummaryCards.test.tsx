import { render, screen } from '@testing-library/react';
import { TotalCostContent } from './CostSummaryCards';
import type { CostSummary } from './types';

const summary = (over: Partial<CostSummary> = {}): CostSummary => ({
  totalCost: 22,
  deltaPct: 10,
  efficiency: 0.3,
  totalSaving: 0,
  ...over,
});

describe('TotalCostContent', () => {
  it('renders the total cost headline', () => {
    render(<TotalCostContent summary={summary()} />);
    expect(screen.getByText('Total Cost')).toBeInTheDocument();
    expect(screen.getByText('USD 22.00')).toBeInTheDocument();
  });

  it('shows an upward delta chip against the previous window', () => {
    render(<TotalCostContent summary={summary({ deltaPct: 10 })} />);
    expect(screen.getByText('10% vs prev window')).toBeInTheDocument();
  });

  it('shows a downward delta with its magnitude only', () => {
    render(<TotalCostContent summary={summary({ deltaPct: -8 })} />);
    expect(screen.getByText('8% vs prev window')).toBeInTheDocument();
  });

  it('falls back to a "No previous window" note when the delta is unknown', () => {
    render(<TotalCostContent summary={summary({ deltaPct: null })} />);
    expect(screen.getByText('No previous window')).toBeInTheDocument();
  });
});
