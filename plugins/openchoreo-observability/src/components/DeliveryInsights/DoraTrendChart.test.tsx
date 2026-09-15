import { render, screen } from '@testing-library/react';
import { DoraTrendChart } from './DoraTrendChart';

// recharts measures 0×0 in jsdom; mock the primitives so the props each chart
// element receives can be asserted directly.
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  LineChart: ({ children }: any) => (
    <div data-testid="line-chart">{children}</div>
  ),
  BarChart: ({ children }: any) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Line: ({ dataKey, dot, connectNulls }: any) => (
    <div
      data-testid="line"
      data-key={dataKey}
      data-dot={dot ? 'on' : 'off'}
      data-connect-nulls={connectNulls ? 'on' : 'off'}
    />
  ),
  Bar: ({ dataKey }: any) => <div data-testid="bar" data-key={dataKey} />,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
}));

// MTTR and lead time only carry a value for buckets that recorded one, so a
// measurement surrounded by empty buckets is the normal shape, not an edge case.
const sparse = [
  { bucketStart: '2026-09-09T00:00:00Z', meanMs: 3000 },
  { bucketStart: '2026-09-10T00:00:00Z', meanMs: null },
  { bucketStart: '2026-09-11T00:00:00Z', meanMs: null },
  { bucketStart: '2026-09-12T00:00:00Z', meanMs: 12290000 },
];

const renderChart = () =>
  render(
    <DoraTrendChart
      title="Mean Time to Recovery"
      granularity="daily"
      data={sparse}
      series={[{ dataKey: 'meanMs', label: 'Mean', color: '#000' }]}
      variant="line"
      valueFormatter={v => String(v)}
    />,
  );

describe('DoraTrendChart', () => {
  it('draws dots so an isolated measurement is still visible', () => {
    renderChart();
    // With connectNulls off, a point whose neighbours are both null has no
    // segment to draw. Without a dot it renders as nothing at all, which is how
    // a populated MTTR series came to look empty.
    expect(screen.getByTestId('line')).toHaveAttribute('data-dot', 'on');
  });

  it('leaves gaps unbridged rather than implying continuous coverage', () => {
    renderChart();
    expect(screen.getByTestId('line')).toHaveAttribute(
      'data-connect-nulls',
      'off',
    );
  });
});
