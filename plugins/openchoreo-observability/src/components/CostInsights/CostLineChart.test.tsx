import { render, screen, fireEvent } from '@testing-library/react';
import { CostLineChart } from './CostLineChart';
import type { CostSeriesPoint } from './types';

// recharts measures 0×0 in jsdom; mock the primitives and invoke the custom
// tooltip/legend render props so their code is exercised.
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  LineChart: ({ children }: any) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: ({ dataKey }: any) => <div data-testid="line" data-key={dataKey} />,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: ({ content }: any) =>
    content?.({
      active: true,
      label: '2026-07-01T00:00:00.000Z',
      payload: [
        { dataKey: 'gcp', name: 'gcp', value: 10 },
        { dataKey: 'shop', name: 'shop', value: 2 },
      ],
    }) ?? null,
  Legend: ({ content }: any) => <div>{content?.()}</div>,
}));

const series: CostSeriesPoint[] = [
  { timestamp: '2026-07-01T00:00:00.000Z', gcp: 10, shop: 2 },
  { timestamp: '2026-07-02T00:00:00.000Z', gcp: 6 },
];

describe('CostLineChart', () => {
  it('renders one line per series key', () => {
    render(<CostLineChart series={series} seriesKeys={['gcp', 'shop']} />);
    expect(
      screen.getAllByTestId('line').map(l => l.getAttribute('data-key')),
    ).toEqual(['gcp', 'shop']);
  });

  it('renders an empty state when there is no data', () => {
    render(<CostLineChart series={[]} seriesKeys={[]} />);
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
    expect(screen.getByText(/No cost data to plot/i)).toBeInTheDocument();
  });

  it('renders tooltip rows sorted by value', () => {
    render(<CostLineChart series={series} seriesKeys={['gcp', 'shop']} />);
    expect(screen.getByText('$10.00')).toBeInTheDocument();
    expect(screen.getByText('$2.00')).toBeInTheDocument();
  });

  it('toggles a series off via its legend item', () => {
    render(<CostLineChart series={series} seriesKeys={['gcp', 'shop']} />);
    const legendItem = screen.getByRole('button', { name: 'gcp' });
    fireEvent.click(legendItem);
    expect(legendItem).toHaveStyle('text-decoration: line-through');
  });
});
