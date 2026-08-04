import { render, screen, fireEvent } from '@testing-library/react';
import { CostInsightsTable } from './CostInsightsTable';
import type { CostRow } from './types';

const rows: CostRow[] = [
  {
    key: 'gcp',
    label: 'gcp',
    cpuCost: 10,
    memoryCost: 12,
    total: 22,
    efficiency: 0.3,
    deltaPct: 10,
  },
  {
    key: 'shop',
    label: 'shop',
    cpuCost: 2,
    memoryCost: 4,
    total: 6,
    efficiency: 0.7,
    deltaPct: null,
  },
];

describe('CostInsightsTable', () => {
  it('renders the standard columns for a namespace-level view', () => {
    render(<CostInsightsTable level="namespace" rows={rows} />);
    expect(screen.getByText('Project')).toBeInTheDocument();
    expect(screen.getByText('gcp')).toBeInTheDocument();
    expect(screen.getByText('22.00000')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument(); // efficiency
    expect(screen.getByText('+10%')).toBeInTheDocument(); // delta
    expect(screen.getByText('—')).toBeInTheDocument(); // null delta for shop
  });

  it('renders an Environment table without optimizing columns at component level', () => {
    const componentRows: CostRow[] = [
      {
        key: 'dev',
        label: 'dev',
        cpuCost: 2,
        memoryCost: 3,
        total: 5,
        efficiency: 0.6,
        deltaPct: null,
      },
    ];
    render(<CostInsightsTable level="component" rows={componentRows} />);
    expect(screen.getByText('Environment')).toBeInTheDocument();
    expect(screen.queryByText('Cost After Optimizing')).not.toBeInTheDocument();
    expect(screen.getByText('dev')).toBeInTheDocument();
    expect(screen.getByText('5.00000')).toBeInTheDocument(); // total
  });

  it('drills into a row when onDrill is provided', () => {
    const onDrill = jest.fn();
    render(
      <CostInsightsTable level="namespace" rows={rows} onDrill={onDrill} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'gcp' }));
    expect(onDrill).toHaveBeenCalledWith('gcp');
  });

  it('renders the dimension as plain text without onDrill', () => {
    render(<CostInsightsTable level="namespace" rows={rows} />);
    expect(
      screen.queryByRole('button', { name: 'gcp' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('gcp')).toBeInTheDocument();
  });

  it('sorts by total descending by default and toggles on header click', () => {
    render(<CostInsightsTable level="namespace" rows={rows} />);

    const dimensionCells = () =>
      screen
        .getAllByRole('row')
        .slice(1) // drop the header row
        .map(row => row.querySelector('td')?.textContent);

    // Default: highest total first (gcp 22 before shop 6).
    expect(dimensionCells()).toEqual(['gcp', 'shop']);

    // Clicking the active Total header toggles to ascending.
    fireEvent.click(screen.getByRole('button', { name: /Total \(USD\)/ }));
    expect(dimensionCells()).toEqual(['shop', 'gcp']);
  });

  it('renders an empty state when there are no rows', () => {
    render(<CostInsightsTable level="namespace" rows={[]} />);
    expect(
      screen.getByText(/No cost data for the selected scope/i),
    ).toBeInTheDocument();
  });
});
