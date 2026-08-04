import { render, screen } from '@testing-library/react';
import { CostInsightsGraph } from './CostInsightsGraph';
import type { CostSeriesPoint } from './types';

// recharts' ResponsiveContainer measures its parent, which is 0×0 in jsdom, so
// the real chart renders nothing. Mock the primitives to expose the props we
// care about (one <Bar> per stack key) as inspectable DOM.
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: ({ children }: any) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: ({ dataKey }: any) => <div data-testid="bar" data-key={dataKey} />,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

const series: CostSeriesPoint[] = [
  { timestamp: '2026-07-01T00:00:00.000Z', gcp: 10, shop: 2 },
  { timestamp: '2026-07-02T00:00:00.000Z', gcp: 6 },
];

describe('CostInsightsGraph', () => {
  it('renders a stacked bar per series key', () => {
    render(<CostInsightsGraph series={series} seriesKeys={['gcp', 'shop']} />);
    const bars = screen.getAllByTestId('bar');
    expect(bars.map(b => b.getAttribute('data-key'))).toEqual(['gcp', 'shop']);
  });

  it('renders an empty state when there is no series data', () => {
    render(<CostInsightsGraph series={[]} seriesKeys={[]} />);
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
    expect(
      screen.getByText(/No cost data to plot for the selected scope/i),
    ).toBeInTheDocument();
  });

  it('renders the empty state when there are points but no stack keys', () => {
    render(<CostInsightsGraph series={series} seriesKeys={[]} />);
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
    expect(screen.getByText(/No cost data to plot/i)).toBeInTheDocument();
  });
});
