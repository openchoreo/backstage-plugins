import { render, screen, fireEvent } from '@testing-library/react';
import { ForecastDivergenceChart } from './ForecastDivergenceChart';
import type { ForecastData } from './types';

const JUL9 = new Date('2026-07-09T00:00:00.000Z').getTime();
const AUG1 = new Date('2026-08-01T00:00:00.000Z').getTime();

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  ComposedChart: ({ children }: any) => (
    <div data-testid="forecast-chart">{children}</div>
  ),
  Line: ({ dataKey, children }: any) => (
    <div data-testid="line" data-key={dataKey}>
      {children}
    </div>
  ),
  // Invoke the end-label render prop for both the last point (renders) and an
  // earlier point (returns null).
  LabelList: ({ content }: any) => (
    <>
      {content?.({ index: 2, x: 100, y: 50 })}
      {content?.({ index: 0, x: 10, y: 10 })}
    </>
  ),
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  // Render both tooltip branches: the pre-fork "actual" point and the two
  // post-fork projections.
  Tooltip: ({ content }: any) => (
    <>
      {content?.({
        active: true,
        label: JUL9,
        payload: [{ dataKey: 'actual', name: 'so far', value: 24 }],
      })}
      {content?.({
        active: true,
        label: AUG1,
        payload: [
          { dataKey: 'atCurrent', name: 'at current rate', value: 90 },
          {
            dataKey: 'ifApplied',
            name: 'if recommendations applied',
            value: 70,
          },
        ],
      })}
    </>
  ),
}));

const forecast: ForecastData = {
  points: [
    { timestamp: '2026-07-01T00:00:00.000Z', actual: 0 },
    {
      timestamp: '2026-07-09T00:00:00.000Z',
      actual: 24,
      atCurrent: 24,
      ifApplied: 24,
    },
    { timestamp: '2026-08-01T00:00:00.000Z', atCurrent: 90, ifApplied: 70 },
  ],
  atCurrentTotal: 90,
  ifAppliedTotal: 70,
  leftOnTable: 20,
};

describe('ForecastDivergenceChart', () => {
  it('renders the three projection lines with a clickable legend', () => {
    render(<ForecastDivergenceChart forecast={forecast} />);
    expect(
      screen.getAllByTestId('line').map(l => l.getAttribute('data-key')),
    ).toEqual(['actual', 'atCurrent', 'ifApplied']);
    // Appears in both the legend and the (mock-invoked) tooltip.
    expect(screen.getAllByText('so far').length).toBeGreaterThan(0);
    expect(screen.getAllByText('at current rate').length).toBeGreaterThan(0);
  });

  it('renders both tooltip branches and the end labels', () => {
    render(<ForecastDivergenceChart forecast={forecast} />);
    // Pre-fork tooltip shows only "so far"; post-fork shows both projections.
    expect(screen.getByText('$24.00')).toBeInTheDocument();
    expect(screen.getByText('$90.00')).toBeInTheDocument();
    expect(screen.getByText('$70.00')).toBeInTheDocument();
    // End labels drawn at the last point.
    expect(screen.getAllByText('at current rate').length).toBeGreaterThan(1);
  });

  it('toggles a line off via its legend item', () => {
    render(<ForecastDivergenceChart forecast={forecast} />);
    const legendItem = screen.getByRole('button', { name: 'so far' });
    fireEvent.click(legendItem);
    expect(legendItem).toHaveStyle('text-decoration: line-through');
  });

  it('renders an empty state when there is no forecast', () => {
    render(<ForecastDivergenceChart forecast={null} />);
    expect(screen.queryByTestId('forecast-chart')).not.toBeInTheDocument();
    expect(screen.getByText(/Not enough data to project/i)).toBeInTheDocument();
  });
});
