import { screen, fireEvent } from '@testing-library/react';
import { renderInTestApp } from '@backstage/test-utils';
import { DoraBreakdownTable } from './DoraBreakdownTable';
import type { DoraBreakdownRow } from './useDoraBreakdown';

const summary = (total: number, classification: string) => ({
  deploymentFrequency: {
    total,
    perDay: total / 30,
    classification,
    deltaPct: 12,
  },
  leadTime: {
    p50Ms: 3600000,
    p95Ms: 7200000,
    coverage: 1,
    classification,
    deltaPct: null,
  },
  changeFailureRate: {
    rate: 0.25,
    failed: 1,
    total: 4,
    classification,
    deltaPct: null,
  },
  mttr: {
    meanMs: 1800000,
    p50Ms: 1800000,
    recoveries: 2,
    classification,
    deltaPct: null,
  },
});

// A project row (catalog-backed, so it drills) and an environment row (no
// entity, so it applies as a filter).
const projectRow: DoraBreakdownRow = {
  name: 'checkout',
  scope: { namespace: 'default', project: 'checkout' },
  entityRef: { kind: 'System', namespace: 'default', name: 'checkout' },
  summary: summary(30, 'Elite') as any,
};

const envRow: DoraBreakdownRow = {
  name: 'production',
  scope: { namespace: 'default', environment: 'production' },
  summary: summary(10, 'High') as any,
};

const renderTable = (
  props: Partial<Parameters<typeof DoraBreakdownTable>[0]>,
) =>
  renderInTestApp(
    <DoraBreakdownTable
      childLabel="Project"
      rows={[projectRow]}
      loading={false}
      error={null}
      {...props}
    />,
  );

describe('DoraBreakdownTable', () => {
  it('renders a row per child with its metrics and rating', async () => {
    await renderTable({});
    expect(screen.getByText('checkout')).toBeInTheDocument();
    expect(screen.getByText('Elite')).toBeInTheDocument();
    // Lead time p50 of 1h and CFR of 25% are formatted for display.
    expect(screen.getByText('1.0h')).toBeInTheDocument();
    expect(screen.getByText('25.0%')).toBeInTheDocument();
  });

  it('drills into an entity-backed row when clicked', async () => {
    const onDrill = jest.fn();
    await renderTable({ onDrill });
    fireEvent.click(screen.getByText('checkout'));
    expect(onDrill).toHaveBeenCalledWith('checkout');
  });

  it('applies an environment row as a filter instead of drilling', async () => {
    const onSelectEnvironment = jest.fn();
    const onDrill = jest.fn();
    await renderTable({
      childLabel: 'Environment',
      rows: [envRow],
      onSelectEnvironment,
      onDrill,
    });
    fireEvent.click(screen.getByText('production'));
    expect(onSelectEnvironment).toHaveBeenCalledWith('production');
    expect(onDrill).not.toHaveBeenCalled();
  });

  it('does not act on a row click when no handler is supplied', async () => {
    // The component level passes neither handler for entity-backed rows; the
    // row must simply not be interactive rather than navigating anywhere.
    await renderTable({ onDrill: undefined });
    fireEvent.click(screen.getByText('checkout'));
    expect(screen.getByText('checkout')).toBeInTheDocument();
  });

  it('shows a progress indicator while loading', async () => {
    await renderTable({ loading: true });
    expect(screen.getByTestId('progress')).toBeInTheDocument();
    expect(screen.queryByText('checkout')).not.toBeInTheDocument();
  });

  it('surfaces a breakdown error', async () => {
    await renderTable({ error: 'catalog unavailable' });
    expect(screen.getByText('catalog unavailable')).toBeInTheDocument();
  });

  it('explains an empty breakdown', async () => {
    await renderTable({ rows: [] });
    expect(
      screen.getByText(/Nothing to break down in this scope yet/i),
    ).toBeInTheDocument();
  });
});
