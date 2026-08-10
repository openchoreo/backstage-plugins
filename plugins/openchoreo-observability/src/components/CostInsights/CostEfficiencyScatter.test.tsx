import { render, screen, fireEvent } from '@testing-library/react';
import { CostEfficiencyScatter } from './CostEfficiencyScatter';
import type { CostRow } from './types';

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  ScatterChart: ({ children }: any) => (
    <div data-testid="scatter-chart">{children}</div>
  ),
  Scatter: ({ data, children }: any) => (
    <div data-testid="scatter" data-count={data?.length}>
      {children}
    </div>
  ),
  Cell: () => null,
  LabelList: () => null,
  ReferenceArea: () => null,
  ZAxis: () => null,
  XAxis: () => null,
  YAxis: () => null,
  // Invoke the tooltip render prop with a bubble's data point.
  Tooltip: ({ content }: any) =>
    content?.({
      active: true,
      payload: [
        { payload: { rank: 1, label: 'gcp', x: 30, y: 22, saving: 5 } },
      ],
    }) ?? null,
}));

const rows: CostRow[] = [
  {
    key: 'gcp',
    label: 'gcp',
    cpuCost: 10,
    memoryCost: 12,
    total: 22,
    efficiency: 0.3,
    saving: 5,
    deltaPct: null,
  },
  {
    key: 'shop',
    label: 'shop',
    cpuCost: 1,
    memoryCost: 1,
    total: 2,
    efficiency: 0.8,
    saving: 0,
    deltaPct: null,
  },
];

describe('CostEfficiencyScatter', () => {
  it('plots a bubble per row and lists them in the numbered legend', () => {
    render(<CostEfficiencyScatter rows={rows} />);
    expect(screen.getByTestId('scatter').getAttribute('data-count')).toBe('2');
    expect(screen.getByText('gcp')).toBeInTheDocument();
    expect(screen.getByText('shop')).toBeInTheDocument();
  });

  it('renders the tooltip with cost, efficiency and potential saving', () => {
    render(<CostEfficiencyScatter rows={rows} />);
    expect(screen.getByText(/cost \$/)).toBeInTheDocument();
    expect(screen.getByText(/efficiency /)).toBeInTheDocument();
    expect(screen.getByText(/potential saving \$/)).toBeInTheDocument();
  });

  it('hides a bubble when its legend item is toggled off', () => {
    render(<CostEfficiencyScatter rows={rows} />);
    expect(screen.getByTestId('scatter').getAttribute('data-count')).toBe('2');
    fireEvent.click(screen.getByRole('button', { name: /gcp/ }));
    expect(screen.getByTestId('scatter').getAttribute('data-count')).toBe('1');
  });

  it('renders an empty state without rows', () => {
    render(<CostEfficiencyScatter rows={[]} />);
    expect(screen.queryByTestId('scatter-chart')).not.toBeInTheDocument();
    expect(screen.getByText(/No cost data/i)).toBeInTheDocument();
  });
});
