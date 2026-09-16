import { screen } from '@testing-library/react';
import { renderInTestApp } from '@backstage/test-utils';
import { DeliveryInsightsContent } from './DeliveryInsightsContent';
import { InsightsLevel } from './useDoraBreakdown';

// The data hooks and the scope filters have their own suites; stub them so this
// one is about what the page chooses to render.
const insightsResult = {
  data: undefined,
  loading: false,
  error: null as string | null,
  refetch: () => {},
};

jest.mock('./useDoraInsights', () => ({
  useDoraInsights: () => insightsResult,
}));

const envRows = [
  { name: 'development', scope: { namespace: 'default' } },
  { name: 'production', scope: { namespace: 'default' } },
];

const breakdownResult = {
  rows: [],
  envRows,
  environments: ['development', 'production'],
  loading: false,
  error: null as string | null,
  refetch: () => {},
};

jest.mock('./useDoraBreakdown', () => ({
  useDoraBreakdown: () => breakdownResult,
}));

jest.mock('../CostInsights/useNamespaceEnvironments', () => ({
  useNamespaceEnvironments: () => ({ environments: [] }),
}));

jest.mock('../ScopeFilters', () => ({
  ScopeFilters: () => <div data-testid="scope-filters" />,
}));

beforeEach(() => {
  insightsResult.error = null;
  breakdownResult.error = null;
});

const render = (envFilter: string, level: InsightsLevel = 'domain') =>
  renderInTestApp(
    <DeliveryInsightsContent
      scope={{ namespace: 'default' }}
      level={level}
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

describe('DeliveryInsightsContent observability notice', () => {
  it('reports a missing observability plane as info, not as an error', async () => {
    insightsResult.error = 'Observability is not enabled for this component';
    await render('development', 'system');

    const notice = screen.getByText(
      'No delivery metrics. Observability plane is not enabled.',
    );
    expect(notice).toBeInTheDocument();
    expect(notice.closest('.MuiAlert-standardInfo')).not.toBeNull();
    expect(notice.closest('.MuiAlert-standardError')).toBeNull();
  });

  // The plane is platform-level, so the copy must not claim a namespace or a
  // project failed to enable something.
  it.each(['domain', 'system', 'component'] as const)(
    'says the same thing at %s level',
    async level => {
      insightsResult.error = 'Observability is not enabled for this component';
      await render('development', level);

      expect(
        screen.getByText(/Observability plane is not enabled/),
      ).toBeInTheDocument();
    },
  );

  it('keeps a genuine failure an error', async () => {
    insightsResult.error = 'Failed to fetch metrics: Bad Gateway';
    await render('development');

    const alert = screen.getByText('Failed to fetch metrics: Bad Gateway');
    expect(alert.closest('.MuiAlert-standardError')).not.toBeNull();
  });

  // The banner above already explains it; a second red copy under the
  // breakdown made one missing setup look like two failures.
  it('does not repeat the notice under the breakdown table', async () => {
    insightsResult.error = 'Observability is not enabled for this component';
    breakdownResult.error = 'Observability is not enabled for this component';
    await render('development');

    expect(
      screen.queryByText('Observability is not enabled for this component'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('Nothing to break down in this scope yet.'),
    ).toBeInTheDocument();
  });
});
