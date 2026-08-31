import { render, screen, fireEvent } from '@testing-library/react';
import { CostInsightsTable } from './CostInsightsTable';
import type { CostRow, CostScope } from './types';

// The Apply button pulls in Backstage APIs (discovery, catalog, permission);
// stub it so the table test stays a pure rendering test.
jest.mock('./CostOptimizeButton', () => ({
  CostOptimizeButton: ({ env }: { env: string }) => (
    <button type="button">Apply {env}</button>
  ),
}));

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

const scope: CostScope = {
  namespace: 'default',
  project: 'demo',
  component: 'ad',
};

describe('CostInsightsTable', () => {
  it('renders the standard columns for a namespace-level view', () => {
    render(<CostInsightsTable level="namespace" rows={rows} />);
    expect(screen.getByText('Project')).toBeInTheDocument();
    expect(screen.getByText('gcp')).toBeInTheDocument();
    expect(screen.getByText('22.00')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument(); // efficiency
    expect(screen.getByText('+10%')).toBeInTheDocument(); // delta
    expect(screen.getByText('—')).toBeInTheDocument(); // null delta for shop
  });

  it('renders the recommendation columns, the resource change and saving, and an Apply button at component level', () => {
    const componentRows: CostRow[] = [
      {
        key: 'dev',
        label: 'dev',
        cpuCost: 2,
        memoryCost: 3,
        total: 5,
        efficiency: 0.6,
        deltaPct: null,
        recommendation: {
          cpuRequest: '50m',
          cpuLimit: '100m',
          memoryRequest: '64Mi',
          memoryLimit: '128Mi',
          cpuCost: 1,
          memoryCost: 1.5,
          total: 2.5,
          current: {
            cpuRequest: '100m',
            memoryRequest: '128Mi',
          },
        },
      },
    ];
    render(
      <CostInsightsTable
        level="component"
        rows={componentRows}
        scope={scope}
        onOptimized={jest.fn()}
      />,
    );
    expect(screen.getByText('Environment')).toBeInTheDocument();
    expect(screen.getByText('Current cost (USD)')).toBeInTheDocument();
    expect(screen.getByText('Recommended change')).toBeInTheDocument();
    expect(screen.getByText('Saving (USD)')).toBeInTheDocument();
    // Saving = current total − recommended total: 5 − 2.5.
    expect(screen.getByText('2.50')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument(); // saving percentage
    // The resource-request changes driving the saving.
    expect(screen.getByText('→ 50m')).toBeInTheDocument();
    expect(screen.getByText('→ 64Mi')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Apply dev' }),
    ).toBeInTheDocument();
  });

  it('replaces the recommendation cells with a note when several components are in scope', () => {
    const componentRows: CostRow[] = [
      {
        key: 'dev',
        label: 'dev',
        cpuCost: 2,
        memoryCost: 3,
        total: 5,
        efficiency: 0.6,
        deltaPct: null,
        recommendation: {
          cpuRequest: '50m',
          cpuCost: 1,
          memoryCost: 1,
          total: 2,
          current: { cpuRequest: '100m' },
        },
      },
    ];
    render(
      <CostInsightsTable
        level="component"
        rows={componentRows}
        scope={scope}
        onOptimized={jest.fn()}
        singleComponent={false}
      />,
    );
    expect(
      screen.getByText(/Select a single component to see recommended changes/i),
    ).toBeInTheDocument();
    // The recommended change, saving and Apply button are withheld.
    expect(screen.queryByText('→ 50m')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Apply/ }),
    ).not.toBeInTheDocument();
  });

  it('shows the stale-recommendation notice with the spec update time', () => {
    const componentRows: CostRow[] = [
      {
        key: 'dev',
        label: 'dev',
        cpuCost: 2,
        memoryCost: 3,
        total: 5,
        efficiency: 0.6,
        deltaPct: null,
        recommendationStale: true,
        recommendationStaleSince: '2026-08-01T10:30:00.000Z',
      },
    ];
    render(
      <CostInsightsTable
        level="component"
        rows={componentRows}
        scope={scope}
        onOptimized={jest.fn()}
      />,
    );
    expect(screen.getByText(/release binding was updated/)).toBeInTheDocument();
    expect(
      screen.getByText(/after this time window started/),
    ).toBeInTheDocument();
    // No Apply button while the recommendation is withheld.
    expect(
      screen.queryByRole('button', { name: /Apply/ }),
    ).not.toBeInTheDocument();
  });

  it('shows a dash for a non-positive saving (recommended cost not lower)', () => {
    const componentRows: CostRow[] = [
      {
        key: 'dev',
        label: 'dev',
        cpuCost: 2,
        memoryCost: 3,
        total: 5,
        efficiency: 0.6,
        deltaPct: null,
        recommendation: {
          cpuRequest: '200m',
          cpuCost: 4,
          memoryCost: 4,
          total: 8, // higher than current 5 -> saving is negative
          current: { cpuRequest: '100m' },
        },
      },
    ];
    render(
      <CostInsightsTable
        level="component"
        rows={componentRows}
        scope={scope}
        onOptimized={jest.fn()}
      />,
    );
    // The recommended change still renders, but the saving is dashed.
    expect(screen.getByText('→ 200m')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('sorts component rows by saving and toggles other columns', () => {
    const componentRows: CostRow[] = [
      {
        key: 'dev',
        label: 'dev',
        cpuCost: 2,
        memoryCost: 3,
        total: 5,
        efficiency: 0.6,
        deltaPct: null,
        recommendation: {
          cpuRequest: '50m',
          cpuCost: 1,
          memoryCost: 1,
          total: 2, // saving 3
          current: { cpuRequest: '100m' },
        },
      },
      {
        key: 'prod',
        label: 'prod',
        cpuCost: 4,
        memoryCost: 4,
        total: 8,
        efficiency: 0.9,
        deltaPct: null,
        recommendation: {
          cpuRequest: '70m',
          cpuCost: 3,
          memoryCost: 3,
          total: 6, // saving 2
          current: { cpuRequest: '100m' },
        },
      },
    ];
    render(
      <CostInsightsTable
        level="component"
        rows={componentRows}
        scope={scope}
        onOptimized={jest.fn()}
      />,
    );

    const envCells = () =>
      screen
        .getAllByRole('row')
        .slice(1)
        .map(row => row.querySelector('td')?.textContent);

    // Default: highest saving first (dev 3 before prod 2).
    expect(envCells()).toEqual(['dev', 'prod']);

    // Sorting by Environment ascending orders alphabetically.
    fireEvent.click(screen.getByRole('button', { name: /Environment/ }));
    expect(envCells()).toEqual(['dev', 'prod']);

    // Sorting by Efficiency descending puts prod (0.9) first.
    fireEvent.click(screen.getByRole('button', { name: /Efficiency/ }));
    expect(envCells()).toEqual(['prod', 'dev']);
  });

  it('shows dashes and no Apply button when a row has no recommendation', () => {
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
    render(
      <CostInsightsTable
        level="component"
        rows={componentRows}
        scope={scope}
        onOptimized={jest.fn()}
      />,
    );
    expect(screen.getByText('Recommended change')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Apply/ }),
    ).not.toBeInTheDocument();
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
