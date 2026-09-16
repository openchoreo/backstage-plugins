import { screen } from '@testing-library/react';
import { renderInTestApp } from '@backstage/test-utils';
import { DeliveryInsightsContent } from './DeliveryInsightsContent';

// The data hooks and the scope filters have their own suites; stub them so this
// one is about what the page chooses to render.
jest.mock('./useDoraInsights', () => ({
  useDoraInsights: () => ({
    data: undefined,
    loading: false,
    error: null,
    refetch: () => {},
  }),
}));

const envRows = [
  { name: 'development', scope: { namespace: 'default' } },
  { name: 'production', scope: { namespace: 'default' } },
];

jest.mock('./useDoraBreakdown', () => ({
  useDoraBreakdown: () => ({
    rows: [],
    envRows,
    environments: ['development', 'production'],
    loading: false,
    error: null,
    refetch: () => {},
  }),
}));

jest.mock('../CostInsights/useNamespaceEnvironments', () => ({
  useNamespaceEnvironments: () => ({ environments: [] }),
}));

jest.mock('../ScopeFilters', () => ({
  ScopeFilters: () => <div data-testid="scope-filters" />,
}));

const render = (envFilter: string) =>
  renderInTestApp(
    <DeliveryInsightsContent
      scope={{ namespace: 'default' }}
      level="domain"
      onScopeChange={() => {}}
      rangeDays={30}
      granularity="daily"
      envFilter={envFilter}
      onRangeDaysChange={() => {}}
      onGranularityChange={() => {}}
      onEnvFilterChange={() => {}}
    />,
  );

// Every query is scoped to one environment, so the filter is never empty once
// environments exist -- an effect settles it on the first. Gating this section
// on an empty filter therefore hid it permanently. The cards scope each of
// their own queries, so they are a comparison across environments and belong on
// the page whatever the filter says.
describe('DeliveryInsightsContent per-environment cards', () => {
  it('shows the environment section while an environment is selected', async () => {
    await render('development');
    expect(
      screen.getByText('Delivery performance by environment'),
    ).toBeInTheDocument();
  });

  it('shows it for any selected environment', async () => {
    await render('production');
    expect(
      screen.getByText('Delivery performance by environment'),
    ).toBeInTheDocument();
  });
});
