import { screen } from '@testing-library/react';
import { renderInTestApp } from '@backstage/test-utils';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { ObservabilityAlertsPage } from './ObservabilityAlertsPage';

// ---- Mocks (own hooks and child components only) ----

const mockUseAlertsPermission = jest.fn();
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useAlertsPermission: () => mockUseAlertsPermission(),
}));

const mockUseGetNamespaceAndProjectByEntity = jest.fn();
const mockUseGetEnvironmentsByNamespace = jest.fn();
const mockUseComponentAlerts = jest.fn();
const mockUseUrlFiltersForAlerts = jest.fn();

jest.mock('../../hooks', () => ({
  useGetNamespaceAndProjectByEntity: (...args: any[]) =>
    mockUseGetNamespaceAndProjectByEntity(...args),
  useGetEnvironmentsByNamespace: (...args: any[]) =>
    mockUseGetEnvironmentsByNamespace(...args),
  useComponentAlerts: (...args: any[]) => mockUseComponentAlerts(...args),
  useUrlFiltersForAlerts: (...args: any[]) =>
    mockUseUrlFiltersForAlerts(...args),
}));

jest.mock('./AlertsFilter', () => ({
  AlertsFilter: ({ environments, filters }: any) => (
    <div data-testid="alerts-filter">
      <span data-testid="env-count">{environments.length}</span>
      <span data-testid="filter-env">{filters.environmentId}</span>
    </div>
  ),
}));

jest.mock('./AlertsTable', () => ({
  AlertsTable: ({ alerts, loading }: any) => (
    <div data-testid="alerts-table">
      <span data-testid="alert-count">{alerts.length}</span>
      <span data-testid="table-loading">{String(loading)}</span>
      {alerts.map((a: any) => (
        <div key={a.alertId} data-testid={`alert-${a.alertId}`}>
          {a.ruleName}
        </div>
      ))}
    </div>
  ),
}));

jest.mock('./AlertsActions', () => ({
  AlertsActions: ({ totalCount, onRefresh }: any) => (
    <div data-testid="alerts-actions">
      <span data-testid="total-count">{totalCount}</span>
      <button data-testid="refresh-btn" onClick={onRefresh}>
        Refresh
      </button>
    </div>
  ),
}));

// ---- Helpers ----

const defaultEntity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'api-service',
    namespace: 'default',
    annotations: {
      'openchoreo.io/namespace': 'dev-ns',
      'openchoreo.io/component': 'api-service',
    },
  },
  spec: { owner: 'team-a', system: 'my-project' },
};

const defaultFilters = {
  environmentId: 'env-dev',
  timeRange: '1h',
  sortOrder: 'desc' as const,
  severity: [],
  searchQuery: '',
};

function renderPage() {
  return renderInTestApp(
    <EntityProvider entity={defaultEntity}>
      <ObservabilityAlertsPage />
    </EntityProvider>,
  );
}

function setupDefaultMocks() {
  mockUseAlertsPermission.mockReturnValue({
    canViewAlerts: true,
    loading: false,
    deniedTooltip: '',
  });

  mockUseGetNamespaceAndProjectByEntity.mockReturnValue({
    namespace: 'dev-ns',
    project: 'my-project',
  });

  mockUseGetEnvironmentsByNamespace.mockReturnValue({
    environments: [{ name: 'development', displayName: 'Development' }],
    loading: false,
    error: null,
  });

  mockUseUrlFiltersForAlerts.mockReturnValue({
    filters: defaultFilters,
    updateFilters: jest.fn(),
  });

  mockUseComponentAlerts.mockReturnValue({
    alerts: [
      {
        alertId: 'a1',
        ruleName: 'High CPU',
        severity: 'critical',
        timestamp: '2024-06-01T10:00:00Z',
      },
      {
        alertId: 'a2',
        ruleName: 'Memory Warning',
        severity: 'warning',
        timestamp: '2024-06-01T10:05:00Z',
      },
    ],
    loading: false,
    error: null,
    fetchAlerts: jest.fn(),
    refresh: jest.fn(),
  });
}

// ---- Tests ----

describe('ObservabilityAlertsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  it('shows progress while checking permissions', async () => {
    mockUseAlertsPermission.mockReturnValue({
      canViewAlerts: false,
      loading: true,
      deniedTooltip: '',
    });

    await renderPage();

    expect(screen.getByTestId('progress')).toBeInTheDocument();
  });

  it('shows permission denied when user lacks access', async () => {
    mockUseAlertsPermission.mockReturnValue({
      canViewAlerts: false,
      loading: false,
      deniedTooltip: 'No alert access',
    });

    await renderPage();

    expect(screen.getByText('Permission Denied')).toBeInTheDocument();
  });

  it('renders filter, actions, and table when permitted', async () => {
    await renderPage();

    expect(screen.getByTestId('alerts-filter')).toBeInTheDocument();
    expect(screen.getByTestId('alerts-actions')).toBeInTheDocument();
    expect(screen.getByTestId('alerts-table')).toBeInTheDocument();
  });

  it('passes environments to filter', async () => {
    await renderPage();

    expect(screen.getByTestId('env-count')).toHaveTextContent('1');
  });

  it('renders alert entries in the table', async () => {
    await renderPage();

    expect(screen.getByTestId('alert-count')).toHaveTextContent('2');
    expect(screen.getByText('High CPU')).toBeInTheDocument();
    expect(screen.getByText('Memory Warning')).toBeInTheDocument();
  });

  it('shows total count in actions', async () => {
    await renderPage();

    expect(screen.getByTestId('total-count')).toHaveTextContent('2');
  });

  it('shows environment error', async () => {
    mockUseGetEnvironmentsByNamespace.mockReturnValue({
      environments: [],
      loading: false,
      error: 'Failed to fetch environments',
    });

    await renderPage();

    expect(
      screen.getByText('Failed to fetch environments'),
    ).toBeInTheDocument();
  });

  it('shows alerts error with Retry button', async () => {
    mockUseComponentAlerts.mockReturnValue({
      alerts: [],
      loading: false,
      error: 'Connection timed out',
      fetchAlerts: jest.fn(),
      refresh: jest.fn(),
    });

    await renderPage();

    expect(screen.getByText('Connection timed out')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('shows info message when observability is disabled', async () => {
    mockUseComponentAlerts.mockReturnValue({
      alerts: [],
      loading: false,
      error: 'Observability is not enabled for this component',
      fetchAlerts: jest.fn(),
      refresh: jest.fn(),
    });

    await renderPage();

    expect(
      screen.getByText(
        'Observability is not enabled for this component. Please enable observability to view alerts.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();
  });

  it('shows no environments alert when none found', async () => {
    mockUseGetEnvironmentsByNamespace.mockReturnValue({
      environments: [],
      loading: false,
      error: null,
    });

    mockUseUrlFiltersForAlerts.mockReturnValue({
      filters: { ...defaultFilters, environmentId: '' },
      updateFilters: jest.fn(),
    });

    await renderPage();

    expect(
      screen.getByText(
        'No environments found. Make sure your component is properly configured.',
      ),
    ).toBeInTheDocument();
  });

  it('does not render actions/table when no environment selected', async () => {
    mockUseUrlFiltersForAlerts.mockReturnValue({
      filters: { ...defaultFilters, environmentId: '' },
      updateFilters: jest.fn(),
    });

    await renderPage();

    expect(screen.queryByTestId('alerts-actions')).not.toBeInTheDocument();
    expect(screen.queryByTestId('alerts-table')).not.toBeInTheDocument();
  });

  it('filters alerts by severity client-side', async () => {
    mockUseUrlFiltersForAlerts.mockReturnValue({
      filters: { ...defaultFilters, severity: ['critical'] },
      updateFilters: jest.fn(),
    });

    await renderPage();

    // Only the critical alert should pass through
    expect(screen.getByTestId('alert-count')).toHaveTextContent('1');
    expect(screen.getByText('High CPU')).toBeInTheDocument();
  });

  it('filters alerts by search query client-side', async () => {
    mockUseUrlFiltersForAlerts.mockReturnValue({
      filters: { ...defaultFilters, searchQuery: 'memory' },
      updateFilters: jest.fn(),
    });

    await renderPage();

    expect(screen.getByTestId('alert-count')).toHaveTextContent('1');
    expect(screen.getByText('Memory Warning')).toBeInTheDocument();
  });
});
