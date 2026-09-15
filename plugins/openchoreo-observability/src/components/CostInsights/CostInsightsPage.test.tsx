import { screen } from '@testing-library/react';
import { renderInTestApp } from '@backstage/test-utils';
import { CostInsightsPage } from './CostInsightsPage';

// Child components are exercised by their own tests; stub them to lightweight
// markers so this suite focuses on the page's state wiring.
jest.mock('./CostInsightsScopeFilters', () => ({
  CostInsightsScopeFilters: () => <div data-testid="scope-filters" />,
}));
jest.mock('./CostInsightsFilters', () => ({
  CostInsightsFilters: () => <div data-testid="filters" />,
  DEFAULT_GRANULARITY: '1d',
}));
jest.mock('./CostInsightsTable', () => ({
  CostInsightsTable: () => <div data-testid="cost-table" />,
}));
jest.mock('./CostInsightsGraphs', () => ({
  CostInsightsGraphs: () => <div data-testid="cost-graph" />,
}));
jest.mock('./ForecastDivergenceChart', () => ({
  ForecastDivergenceChart: () => <div data-testid="forecast" />,
}));
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  ...jest.requireActual('@openchoreo/backstage-plugin-react'),
  TimeRangeFilter: () => <div data-testid="time-range" />,
}));
// The Cost Analysis tab lazy-loads this; stub it so the tab can be exercised
// without its catalog/permission dependencies.
jest.mock('../CostAnalysis', () => ({
  CostAnalysisPage: () => <div data-testid="cost-analysis" />,
}));

const mockUseNamespaceEnvironments = jest.fn();
const mockUseDimensionTitles = jest.fn();
const mockUseCostInsights = jest.fn();

jest.mock('./useNamespaceEnvironments', () => ({
  useNamespaceEnvironments: (...args: any[]) =>
    mockUseNamespaceEnvironments(...args),
}));
jest.mock('./useDimensionTitles', () => ({
  useDimensionTitles: (...args: any[]) => mockUseDimensionTitles(...args),
}));
jest.mock('./useCostInsights', () => ({
  useCostInsights: (...args: any[]) => mockUseCostInsights(...args),
}));

const data = {
  level: 'namespace' as const,
  summary: {
    totalCost: 22,
    deltaPct: 10,
    efficiency: 0.3,
    totalSaving: 0,
  },
  forecast: null,
  rows: [
    {
      key: 'gcp',
      label: 'gcp',
      cpuCost: 10,
      memoryCost: 12,
      total: 22,
      efficiency: 0.3,
      deltaPct: 10,
    },
  ],
  series: [{ timestamp: '2026-07-01T00:00:00.000Z', gcp: 22 }],
  seriesKeys: ['gcp'],
};

function setupDefaults() {
  mockUseNamespaceEnvironments.mockReturnValue({
    environments: [{ name: 'dev', namespace: 'default', displayName: 'Dev' }],
    loading: false,
    error: null,
  });
  mockUseDimensionTitles.mockReturnValue({});
  mockUseCostInsights.mockReturnValue({
    data,
    loading: false,
    isRefetching: false,
    error: null,
    refresh: jest.fn(),
  });
}

const renderPage = (route = '/?namespace=default') =>
  renderInTestApp(<CostInsightsPage />, { routeEntries: [route] });

describe('CostInsightsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaults();
  });

  it('renders the filters, forecast, graphs and table on one page', async () => {
    await renderPage();
    expect(screen.getByTestId('filters')).toBeInTheDocument();
    expect(screen.getByTestId('forecast')).toBeInTheDocument();
    expect(screen.getByTestId('time-range')).toBeInTheDocument();
    expect(screen.getByTestId('cost-graph')).toBeInTheDocument();
    expect(screen.getByTestId('cost-table')).toBeInTheDocument();
  });

  it('shows a loader while cost data loads', async () => {
    mockUseCostInsights.mockReturnValue({
      data: undefined,
      loading: true,
      isRefetching: false,
      error: null,
      refresh: jest.fn(),
    });
    await renderPage();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByTestId('cost-table')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cost-graph')).not.toBeInTheDocument();
  });

  it('shows an error alert when the cost query fails', async () => {
    mockUseCostInsights.mockReturnValue({
      data: undefined,
      loading: false,
      isRefetching: false,
      error: 'Failed to load cost data',
      refresh: jest.fn(),
    });
    await renderPage();
    expect(screen.getByText('Failed to load cost data')).toBeInTheDocument();
  });

  it('rewrites the "observability not enabled" error for the platform view', async () => {
    mockUseCostInsights.mockReturnValue({
      data: undefined,
      loading: false,
      isRefetching: false,
      error: 'Observability is not enabled for this component',
      refresh: jest.fn(),
    });
    await renderPage();
    expect(
      screen.getByText('Cost Insights have not been enabled'),
    ).toBeInTheDocument();
  });

  it('prompts to pick another namespace when it has no environments', async () => {
    mockUseNamespaceEnvironments.mockReturnValue({
      environments: [],
      loading: false,
      error: null,
    });
    await renderPage();
    expect(
      screen.getByText(/No environments found for the selected namespaces/i),
    ).toBeInTheDocument();
  });

  it('surfaces an environments-loading error', async () => {
    mockUseNamespaceEnvironments.mockReturnValue({
      environments: [],
      loading: false,
      error: 'catalog down',
    });
    await renderPage();
    expect(screen.getByText('catalog down')).toBeInTheDocument();
  });

  it('offers both the Insights and Analysis Reports tabs', async () => {
    await renderPage();
    expect(screen.getByText('Insights')).toBeInTheDocument();
    expect(screen.getByText('Analysis Reports')).toBeInTheDocument();
  });

  it('prompts to pick a project on the Cost Analysis tab when none is scoped', async () => {
    await renderPage('/cost-analysis?namespace=default');
    expect(
      screen.getByText(/Select a single project to view its cost analysis/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('cost-analysis')).not.toBeInTheDocument();
  });

  it('renders the Cost Analysis reports once a project is scoped', async () => {
    await renderPage('/cost-analysis?namespace=default&project=onlinestore');
    expect(await screen.findByTestId('cost-analysis')).toBeInTheDocument();
  });
});
