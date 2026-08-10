import { render, screen, fireEvent } from '@testing-library/react';
import {
  CostInsightsGraph,
  CostStackTooltipContent,
} from './CostInsightsGraph';
import type { CostSeriesPoint } from './types';

// recharts measures 0×0 in jsdom; mock the primitives, invoking the custom
// tooltip/legend render props so their code is exercised.
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  ComposedChart: ({ children, onMouseLeave }: any) => (
    <div data-testid="bar-chart" onMouseLeave={onMouseLeave}>
      {children}
    </div>
  ),
  Bar: ({ dataKey, onMouseEnter }: any) => (
    <div data-testid="bar" data-key={dataKey} onMouseEnter={onMouseEnter} />
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
        { dataKey: '__afterRec', name: 'after', value: 8 },
      ],
    }) ?? null,
  Legend: ({ content }: any) => content?.() ?? null,
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

  it('adds the post-recommendation overlay line when an overlay is given', () => {
    render(
      <CostInsightsGraph
        series={series}
        seriesKeys={['gcp', 'shop']}
        recommendationOverlay={{ savingFraction: 0.2 }}
      />,
    );
    const line = screen.getByTestId('line');
    expect(line.getAttribute('data-key')).toBe('__afterRec');
  });

  it('draws no overlay line without a recommendation overlay', () => {
    render(<CostInsightsGraph series={series} seriesKeys={['gcp', 'shop']} />);
    expect(screen.queryByTestId('line')).not.toBeInTheDocument();
  });

  it('renders the tooltip rows and the overlay entry when an overlay is set', () => {
    render(
      <CostInsightsGraph
        series={series}
        seriesKeys={['gcp', 'shop']}
        title="Cost over time"
        recommendationOverlay={{ savingFraction: 0.2 }}
      />,
    );
    // Tooltip rows for each series plus the "If recommendations applied" entry
    // (which also appears in the legend, hence getAllByText).
    expect(screen.getByText('$10.00')).toBeInTheDocument();
    expect(screen.getByText('$8.00')).toBeInTheDocument();
    expect(
      screen.getAllByText('If recommendations applied').length,
    ).toBeGreaterThan(0);
  });

  it('toggles a series off via its legend item', () => {
    render(<CostInsightsGraph series={series} seriesKeys={['gcp', 'shop']} />);
    const legendItem = screen.getByRole('button', { name: 'gcp' });
    fireEvent.click(legendItem);
    expect(legendItem).toHaveStyle('text-decoration: line-through');
  });

  it('toggles a series off via the keyboard', () => {
    render(<CostInsightsGraph series={series} seriesKeys={['gcp', 'shop']} />);
    const legendItem = screen.getByRole('button', { name: 'shop' });
    fireEvent.keyDown(legendItem, { key: 'Enter' });
    expect(legendItem).toHaveStyle('text-decoration: line-through');
  });

  it('toggles the overlay line via its legend item', () => {
    render(
      <CostInsightsGraph
        series={series}
        seriesKeys={['gcp', 'shop']}
        recommendationOverlay={{ savingFraction: 0.2 }}
      />,
    );
    const overlayItem = screen.getByRole('button', {
      name: 'If recommendations applied',
    });
    fireEvent.click(overlayItem);
    expect(overlayItem).toHaveStyle('text-decoration: line-through');
  });

  it('shows the stack total in the tooltip', () => {
    render(<CostInsightsGraph series={series} seriesKeys={['gcp', 'shop']} />);
    expect(screen.getByText('Total')).toBeInTheDocument();
    // 10 (gcp) + 2 (shop); the __afterRec entry is excluded from the total.
    expect(screen.getByText('$12.00')).toBeInTheDocument();
  });

  const isBold = (text: string) =>
    screen
      .getAllByText(text)
      .some(el => el.closest('div')?.style.fontWeight === '600');

  it('highlights the hovered bar segment in the tooltip and clears on leave', () => {
    render(<CostInsightsGraph series={series} seriesKeys={['gcp', 'shop']} />);
    expect(isBold('gcp')).toBe(false);

    fireEvent.mouseEnter(screen.getAllByTestId('bar')[0]);
    expect(isBold('gcp')).toBe(true);

    fireEvent.mouseLeave(screen.getByTestId('bar-chart'));
    expect(isBold('gcp')).toBe(false);
  });
});

describe('CostStackTooltipContent', () => {
  const colorFor = new Map([
    ['onlinestore', '#111'],
    ['web', '#222'],
  ]);
  const payload = [
    { dataKey: 'onlinestore', name: 'onlinestore', value: 10 },
    { dataKey: 'web', name: 'web', value: 5 },
  ];

  it('totals only the visible stacks', () => {
    render(
      <CostStackTooltipContent
        active
        payload={payload}
        label="2026-07-01T00:00:00.000Z"
        seriesKeys={['onlinestore', 'web']}
        activeKey={null}
        colorFor={colorFor}
      />,
    );
    expect(screen.getByText('$15.00')).toBeInTheDocument();
  });

  it('highlights the hovered segment row and not the others', () => {
    render(
      <CostStackTooltipContent
        active
        payload={payload}
        label="2026-07-01T00:00:00.000Z"
        seriesKeys={['onlinestore', 'web']}
        activeKey="onlinestore"
        colorFor={colorFor}
      />,
    );
    expect(screen.getByText('onlinestore').closest('div')).toHaveStyle(
      'font-weight: 600',
    );
    expect(screen.getByText('web').closest('div')).toHaveStyle(
      'font-weight: 400',
    );
  });

  it('renders nothing when inactive', () => {
    const { container } = render(
      <CostStackTooltipContent
        active={false}
        payload={payload}
        seriesKeys={['onlinestore', 'web']}
        activeKey={null}
        colorFor={colorFor}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
