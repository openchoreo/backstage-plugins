import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderInTestApp } from '@backstage/test-utils';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { ObservabilityMetricsPage } from './ObservabilityMetricsPage';

// ---- Mocks (own hooks and child components only) ----

const mockUseMetricsPermission = jest.fn();
const mockUseProjectEnvironments = jest.fn();
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useMetricsPermission: () => mockUseMetricsPermission(),
  ForbiddenState: ({ message }: any) => (
    <div data-testid="forbidden-state">{message}</div>
  ),
  useProjectEnvironments: (...args: any[]) =>
    mockUseProjectEnvironments(...args),
}));

const mockUseGetNamespaceAndProjectByEntity = jest.fn();
const mockUseMetrics = jest.fn();
const mockUseUrlFilters = jest.fn();
const mockUseDataPlaneNetPolProvider = jest.fn();

jest.mock('../../hooks', () => ({
  useGetNamespaceAndProjectByEntity: (...args: any[]) =>
    mockUseGetNamespaceAndProjectByEntity(...args),
  useMetrics: (...args: any[]) => mockUseMetrics(...args),
  useUrlFilters: (...args: any[]) => mockUseUrlFilters(...args),
  useDataPlaneNetPolProvider: (...args: any[]) =>
    mockUseDataPlaneNetPolProvider(...args),
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
  dataPlaneRef: { kind: 'DataPlane', name: 'default-dp' },
};

function renderPage() {
  return renderInTestApp(
    <EntityProvider entity={defaultEntity}>
      <ObservabilityMetricsPage />
    </EntityProvider>,
  );
}

function setupDefaultMocks() {
  mockUseDataPlaneNetPolProvider.mockReturnValue({
    networkPolicyProvider: 'cilium',
    loading: false,
  });
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

  mockUseProjectEnvironments.mockReturnValue({
    environments: [defaultEnvironment],
    loading: false,
    status: 'ok',
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

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
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
    mockUseProjectEnvironments.mockReturnValue({
      environments: [defaultEnvironment],
      loading: true,
      status: 'ok',
      error: null,
    });

    await renderPage();

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
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

    expect(screen.getAllByText('Metrics query failed').length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByText('Retry').length).toBeGreaterThan(0);
  });

  it('shows info message when observability is disabled', async () => {
    mockUseDataPlaneNetPolProvider.mockReturnValue({
      networkPolicyProvider: undefined,
      loading: false,
    });
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
        'Observability is not enabled for this component in the current environment. Enable observability to view metrics.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();
  });

  it('refetches both resource and HTTP metrics when refresh is clicked', async () => {
    const user = userEvent.setup();
    const resourceRefresh = jest.fn();
    // Both sections now refetch via `refresh()` (the query keys on the filters,
    // so a manual refresh re-runs the current key) — the HTTP section watches
    // the parent's `refreshNonce` bump and calls its own `refresh`.
    const httpRefresh = jest.fn();

    mockUseMetrics.mockImplementation(
      (
        _filters: any,
        _entity: any,
        _namespace: any,
        _project: any,
        type?: string,
      ) => {
        if (type === 'http') {
          return {
            metrics: {
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
            refresh: httpRefresh,
          };
        }
        return {
          metrics: {
            cpuUsage: { cpuUsage: [], cpuRequests: [], cpuLimits: [] },
            memoryUsage: {
              memoryUsage: [],
              memoryRequests: [],
              memoryLimits: [],
            },
          },
          loading: false,
          error: null,
          fetchMetrics: jest.fn(),
          refresh: resourceRefresh,
        };
      },
    );

    await renderPage();

    resourceRefresh.mockClear();
    httpRefresh.mockClear();

    await user.click(screen.getByTestId('refresh-btn'));

    expect(resourceRefresh).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(httpRefresh).toHaveBeenCalledTimes(1));
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
