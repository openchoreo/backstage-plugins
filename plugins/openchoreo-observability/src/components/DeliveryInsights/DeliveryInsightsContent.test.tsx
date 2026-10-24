import { fireEvent, screen } from '@testing-library/react';
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

let releaseLines: string[] = [];
jest.mock('../../hooks/useComponentReleaseLines', () => ({
  useComponentReleaseLines: () => releaseLines,
}));

jest.mock('../ScopeFilters', () => ({
  ScopeFilters: () => <div data-testid="scope-filters" />,
}));

beforeEach(() => {
  insightsResult.error = null;
  breakdownResult.error = null;
  releaseLines = [];
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
      onReleaseLineChange={() => {}}
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

describe('DeliveryInsightsContent release line filter', () => {
  const renderComponent = (onReleaseLineChange = jest.fn()) =>
    renderInTestApp(
      <DeliveryInsightsContent
        scope={{ namespace: 'default', project: 'p', component: 'hello' }}
        level="component"
        onScopeChange={() => {}}
        rangeDays={30}
        granularity="daily"
        envFilter="development"
        onRangeDaysChange={() => {}}
        onGranularityChange={() => {}}
        onEnvFilterChange={() => {}}
        onReleaseLineChange={onReleaseLineChange}
      />,
    );

  it('is hidden for a component without release lines', async () => {
    await renderComponent();
    expect(screen.queryByLabelText('Release line')).not.toBeInTheDocument();
  });

  it('lists the component release lines and reports a selection', async () => {
    releaseLines = ['main', 'next'];
    const onReleaseLineChange = jest.fn();
    await renderComponent(onReleaseLineChange);

    fireEvent.mouseDown(screen.getByLabelText('Release line'));
    expect(
      screen.getByRole('option', { name: 'All lines' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: 'next' }));
    expect(onReleaseLineChange).toHaveBeenCalledWith('next');
  });
});
