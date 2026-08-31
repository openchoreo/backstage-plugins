import { render, screen, fireEvent } from '@testing-library/react';
import { CostLineChart, CostLineTooltipContent } from './CostLineChart';
import type { CostSeriesPoint } from './types';

// recharts measures 0×0 in jsdom; mock the primitives and invoke the custom
// tooltip/legend render props so their code is exercised.
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  LineChart: ({ children, onMouseLeave }: any) => (
    <div data-testid="line-chart" onMouseLeave={onMouseLeave}>
      {children}
    </div>
  ),
  Line: ({ dataKey, onMouseEnter }: any) => (
    <div data-testid="line" data-key={dataKey} onMouseEnter={onMouseEnter} />
  ),
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

  it('shows the total of the lines in the tooltip', () => {
    render(<CostLineChart series={series} seriesKeys={['gcp', 'shop']} />);
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('$12.00')).toBeInTheDocument();
  });

  const isBold = (text: string) =>
    screen
      .getAllByText(text)
      .some(el => el.closest('div')?.style.fontWeight === '600');

  it('highlights the hovered line in the tooltip and clears on leave', () => {
    render(<CostLineChart series={series} seriesKeys={['gcp', 'shop']} />);
    expect(isBold('gcp')).toBe(false);

    fireEvent.mouseEnter(screen.getAllByTestId('line')[0]);
    expect(isBold('gcp')).toBe(true);

    fireEvent.mouseLeave(screen.getByTestId('line-chart'));
    expect(isBold('gcp')).toBe(false);
  });
});

describe('CostLineTooltipContent', () => {
  const colorFor = new Map([
    ['onlinestore', '#111'],
    ['web', '#222'],
  ]);
  const payload = [
    { dataKey: 'onlinestore', name: 'onlinestore', value: 10 },
    { dataKey: 'web', name: 'web', value: 5 },
  ];

  it('sums the lines into a total', () => {
    render(
      <CostLineTooltipContent
        active
        payload={payload}
        label="2026-07-01T00:00:00.000Z"
        activeKey={null}
        colorFor={colorFor}
      />,
    );
    expect(screen.getByText('$15.00')).toBeInTheDocument();
  });

  it('highlights the hovered line row and not the others', () => {
    render(
      <CostLineTooltipContent
        active
        payload={payload}
        label="2026-07-01T00:00:00.000Z"
        activeKey="web"
        colorFor={colorFor}
      />,
    );
    expect(screen.getByText('web').closest('div')).toHaveStyle(
      'font-weight: 600',
    );
    expect(screen.getByText('onlinestore').closest('div')).toHaveStyle(
      'font-weight: 400',
    );
  });
});
