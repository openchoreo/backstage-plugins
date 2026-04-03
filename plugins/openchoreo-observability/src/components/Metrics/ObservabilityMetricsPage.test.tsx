import { screen } from '@testing-library/react';
import { renderInTestApp } from '@backstage/test-utils';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { ObservabilityMetricsPage } from './ObservabilityMetricsPage';

// ---- Mocks (own hooks and child components only) ----

const mockUseMetricsPermission = jest.fn();
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useMetricsPermission: () => mockUseMetricsPermission(),
  ForbiddenState: ({ message }: any) => (
    <div data-testid="forbidden-state">{message}</div>
  ),
}));

const mockUseGetNamespaceAndProjectByEntity = jest.fn();
const mockUseGetEnvironmentsByNamespace = jest.fn();
const mockUseMetrics = jest.fn();
const mockUseUrlFilters = jest.fn();

jest.mock('../../hooks', () => ({
  useGetNamespaceAndProjectByEntity: (...args: any[]) =>
    mockUseGetNamespaceAndProjectByEntity(...args),
  useGetEnvironmentsByNamespace: (...args: any[]) =>
    mockUseGetEnvironmentsByNamespace(...args),
  useMetrics: (...args: any[]) => mockUseMetrics(...args),
  useUrlFilters: (...args: any[]) => mockUseUrlFilters(...args),
}));

jest.mock('./MetricsFilters', () => ({
  MetricsFilters: ({ environments, filters }: any) => (
    <div data-testid="metrics-filters">
      <span data-testid="env-count">{environments.length}</span>
      <span data-testid="filter-time">{filters.timeRange}</span>
    </div>
  ),
}));

jest.mock('./MetricGraphByComponent', () => ({
  MetricGraphByComponent: ({ usageType }: any) => (
    <div data-testid={`graph-${usageType}`}>{usageType} chart</div>
  ),
}));

jest.mock('./MetricsActions', () => ({
  MetricsActions: ({ onRefresh, disabled }: any) => (
    <div data-testid="metrics-actions">
      <button data-testid="refresh-btn" onClick={onRefresh} disabled={disabled}>
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
    annotations: {
      'openchoreo.io/namespace': 'dev-ns',
      'openchoreo.io/component': 'api-service',
    },
  },
  spec: { owner: 'team-a' },
};

const defaultEnvironment = {
  uid: 'env-1',
  name: 'development',
  namespace: 'dev-ns',
  displayName: 'Development',
  isProduction: false,
  createdAt: '2024-01-01T00:00:00Z',
};

function renderPage() {
  return renderInTestApp(
    <EntityProvider entity={defaultEntity}>
      <ObservabilityMetricsPage />
    </EntityProvider>,
  );
}

function setupDefaultMocks() {
  mockUseMetricsPermission.mockReturnValue({
    canViewMetrics: true,
    loading: false,
    deniedTooltip: '',
    permissionName: '',
  });

  mockUseGetNamespaceAndProjectByEntity.mockReturnValue({
    namespace: 'dev-ns',
    project: 'my-project',
    error: null,
  });

  mockUseGetEnvironmentsByNamespace.mockReturnValue({
    environments: [defaultEnvironment],
    loading: false,
    error: null,
  });

  mockUseUrlFilters.mockReturnValue({
    filters: {
      environment: defaultEnvironment,
      timeRange: '1h',
    },
    updateFilters: jest.fn(),
  });

  mockUseMetrics.mockReturnValue({
    metrics: {
      cpuUsage: { cpuUsage: [], cpuRequests: [], cpuLimits: [] },
      memoryUsage: {
        memoryUsage: [],
        memoryRequests: [],
        memoryLimits: [],
      },
      networkThroughput: {
        requestCount: [],
        successfulRequestCount: [],
        unsuccessfulRequestCount: [],
      },
      networkLatency: {
        meanLatency: [],
        latencyP50: [],
        latencyP90: [],
        latencyP99: [],
      },
    },
    loading: false,
    error: null,
    fetchMetrics: jest.fn(),
    refresh: jest.fn(),
  });
}

// ---- Tests ----

describe('ObservabilityMetricsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  it('shows progress while checking permissions', async () => {
    mockUseMetricsPermission.mockReturnValue({
      canViewMetrics: false,
      loading: true,
      deniedTooltip: '',
      permissionName: '',
    });

    await renderPage();

    expect(screen.getByTestId('progress')).toBeInTheDocument();
  });

  it('shows forbidden state when user lacks permission', async () => {
    mockUseMetricsPermission.mockReturnValue({
      canViewMetrics: false,
      loading: false,
      deniedTooltip: 'No metrics access',
      permissionName: 'openchoreo.metrics.view',
    });

    await renderPage();

    expect(screen.getByTestId('forbidden-state')).toBeInTheDocument();
    expect(screen.getByText('No metrics access')).toBeInTheDocument();
  });

  it('renders filters and actions when permitted', async () => {
    await renderPage();

    expect(screen.getByTestId('metrics-filters')).toBeInTheDocument();
    expect(screen.getByTestId('metrics-actions')).toBeInTheDocument();
  });

  it('renders all four metric cards', async () => {
    await renderPage();

    expect(screen.getByText('CPU Usage')).toBeInTheDocument();
    expect(screen.getByText('Memory Usage')).toBeInTheDocument();
    expect(screen.getByText('Network Throughput')).toBeInTheDocument();
    expect(screen.getByText('Network Latency')).toBeInTheDocument();
  });

  it('renders metric graph components', async () => {
    await renderPage();

    expect(screen.getByTestId('graph-cpu')).toBeInTheDocument();
    expect(screen.getByTestId('graph-memory')).toBeInTheDocument();
    expect(screen.getByTestId('graph-networkThroughput')).toBeInTheDocument();
    expect(screen.getByTestId('graph-networkLatency')).toBeInTheDocument();
  });

  it('passes environments to filters', async () => {
    await renderPage();

    expect(screen.getByTestId('env-count')).toHaveTextContent('1');
  });

  it('shows progress when loading', async () => {
    mockUseGetEnvironmentsByNamespace.mockReturnValue({
      environments: [defaultEnvironment],
      loading: true,
      error: null,
    });

    await renderPage();

    expect(screen.getByTestId('progress')).toBeInTheDocument();
  });

  it('shows metrics error with Retry button', async () => {
    mockUseMetrics.mockReturnValue({
      metrics: null,
      loading: false,
      error: 'Metrics query failed',
      fetchMetrics: jest.fn(),
      refresh: jest.fn(),
    });

    await renderPage();

    expect(screen.getByText('Metrics query failed')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('shows info message when observability is disabled', async () => {
    mockUseMetrics.mockReturnValue({
      metrics: null,
      loading: false,
      error: 'Observability is not enabled for this component',
      fetchMetrics: jest.fn(),
      refresh: jest.fn(),
    });

    await renderPage();

    expect(
      screen.getByText(
        'Observability is not enabled for this component in this environment. Please enable observability to view metrics.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();
  });

  it('renders nothing for namespace error', async () => {
    mockUseGetNamespaceAndProjectByEntity.mockReturnValue({
      namespace: null,
      project: null,
      error: 'Namespace not found',
    });

    await renderPage();

    expect(screen.queryByTestId('metrics-filters')).not.toBeInTheDocument();
    expect(screen.queryByTestId('metrics-actions')).not.toBeInTheDocument();
  });
});
