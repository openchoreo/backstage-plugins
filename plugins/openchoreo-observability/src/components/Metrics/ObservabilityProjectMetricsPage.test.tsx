import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderInTestApp } from '@backstage/test-utils';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { ObservabilityProjectMetricsPage } from './ObservabilityProjectMetricsPage';

// ---- Mocks (own hooks and child components only) ----

const mockUseMetricsPermission = jest.fn();
const mockUseProjectEnvironments = jest.fn();
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useMetricsPermission: (...args: any[]) => mockUseMetricsPermission(...args),
  ForbiddenState: ({ message, variant }: any) => (
    <div data-testid={`forbidden-state-${variant}`}>{message}</div>
  ),
  useProjectEnvironments: (...args: any[]) =>
    mockUseProjectEnvironments(...args),
}));

const mockUseGetComponentsByProject = jest.fn();
const mockUseMetrics = jest.fn();
const mockUseProjectMetrics = jest.fn();
const mockUseUrlFilters = jest.fn();
const mockUseDataPlaneNetPolProvider = jest.fn();

jest.mock('../../hooks', () => ({
  useGetComponentsByProject: (...args: any[]) =>
    mockUseGetComponentsByProject(...args),
  useMetrics: (...args: any[]) => mockUseMetrics(...args),
  useProjectMetrics: (...args: any[]) => mockUseProjectMetrics(...args),
  useUrlFilters: (...args: any[]) => mockUseUrlFilters(...args),
  useDataPlaneNetPolProvider: (...args: any[]) =>
    mockUseDataPlaneNetPolProvider(...args),
}));

jest.mock('./MetricsFilters', () => ({
  MetricsFilters: ({ components }: any) => (
    <div data-testid="metrics-filters">
      <span data-testid="component-count">{components.length}</span>
    </div>
  ),
}));

// The mode-1 chart — the component page's own, reused verbatim.
jest.mock('./MetricGraphByComponent', () => ({
  MetricGraphByComponent: ({ usageType }: any) => (
    <div data-testid={`graph-${usageType}`} />
  ),
}));

jest.mock('./ProjectMetricGraph', () => ({
  ProjectMetricGraph: ({ usageType, seriesByComponent, colorOf }: any) => (
    <div
      data-testid={`project-graph-${usageType}`}
      data-components={Object.keys(seriesByComponent).sort().join(',')}
      data-series-count={Object.values(seriesByComponent).reduce(
        (total: number, series: any) => total + Object.keys(series).length,
        0,
      )}
      data-has-color-resolver={typeof colorOf === 'function'}
    />
  ),
}));

jest.mock('./HTTPMetricsSection', () => ({
  HTTPMetricsSection: ({ entity }: any) => (
    <div
      data-testid="http-section"
      data-component={
        entity?.metadata?.annotations?.['openchoreo.io/component'] ?? ''
      }
    />
  ),
}));

jest.mock('./ProjectHTTPMetricsSection', () => ({
  ProjectHTTPMetricsSection: ({ components }: any) => (
    <div
      data-testid="project-http-section"
      data-components={components.join(',')}
    />
  ),
}));

jest.mock('./MetricsActions', () => ({
  MetricsActions: ({ onRefresh }: any) => (
    <button data-testid="refresh-btn" onClick={onRefresh}>
      Refresh
    </button>
  ),
}));

// ---- Helpers ----

const projectEntity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'System',
  metadata: {
    name: 'url-shortener',
    annotations: { 'openchoreo.io/namespace': 'dev-ns' },
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

const aggregateMetrics = {
  cpuUsage: {
    cpuUsage: [{ timestamp: '2026-03-05T10:00:00.000Z', value: 0.5 }],
    cpuRequests: [],
    cpuLimits: [],
  },
  memoryUsage: { memoryUsage: [], memoryRequests: [], memoryLimits: [] },
};

const breakdownMetrics = {
  byComponent: {
    api: aggregateMetrics,
    worker: aggregateMetrics,
  },
  failedComponents: [],
};

function renderPage() {
  return renderInTestApp(
    <EntityProvider entity={projectEntity}>
      <ObservabilityProjectMetricsPage />
    </EntityProvider>,
  );
}

/** Selection drives the mode, so tests set it through the URL filters. */
function selectComponents(components: string[]) {
  mockUseUrlFilters.mockReturnValue({
    filters: {
      environment: defaultEnvironment,
      timeRange: '1h',
      components,
    },
    updateFilters: jest.fn(),
  });
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
  mockUseProjectEnvironments.mockReturnValue({
    environments: [defaultEnvironment],
    loading: false,
    status: 'ok',
    error: null,
  });
  mockUseGetComponentsByProject.mockReturnValue({
    components: [{ name: 'api' }, { name: 'worker' }],
    loading: false,
    error: null,
  });
  selectComponents([]);
  mockUseMetrics.mockReturnValue({
    metrics: aggregateMetrics,
    loading: false,
    isRefetching: false,
    error: null,
    fetchMetrics: jest.fn(),
    refresh: jest.fn(),
  });
  mockUseProjectMetrics.mockReturnValue({
    metrics: undefined,
    loading: false,
    isRefetching: false,
    error: undefined,
    refresh: jest.fn(),
  });
}

/** The `enabled` gate is the last argument of both metrics hooks. */
const enabledArgOf = (mock: jest.Mock) =>
  mock.mock.calls[0]?.[5] as boolean | undefined;

// ---- Tests ----

describe('ObservabilityProjectMetricsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  describe('mode 1 — no components selected', () => {
    it('fetches the project-wide aggregate with no component', async () => {
      await renderPage();

      // The project entity has no component annotation, so useMetrics omits
      // the component and the observer returns the project-wide aggregate.
      expect(mockUseMetrics).toHaveBeenCalledWith(
        expect.anything(),
        projectEntity,
        'dev-ns',
        'url-shortener',
        'resource',
        true,
      );
      expect(projectEntity.metadata.annotations).not.toHaveProperty(
        'openchoreo.io/component',
      );
      // The fan-out hook is still called (rules of hooks) but gated off.
      expect(enabledArgOf(mockUseProjectMetrics)).toBe(false);
    });

    it('renders the component page charts, not the project ones', async () => {
      await renderPage();

      expect(screen.getByTestId('graph-cpu')).toBeInTheDocument();
      expect(screen.getByTestId('graph-memory')).toBeInTheDocument();
      expect(screen.queryByTestId('project-graph-cpu')).not.toBeInTheDocument();
    });

    it('renders the component page HTTP section, scoped to no component', async () => {
      await renderPage();

      expect(screen.getByTestId('http-section')).toHaveAttribute(
        'data-component',
        '',
      );
      expect(
        screen.queryByTestId('project-http-section'),
      ).not.toBeInTheDocument();
    });

    it('shows the CPU, Memory and HTTP cards', async () => {
      await renderPage();

      expect(screen.getByText('CPU Usage')).toBeInTheDocument();
      expect(screen.getByText('Memory Usage')).toBeInTheDocument();
      expect(screen.getByTestId('http-section')).toBeInTheDocument();
    });

    it('stays in mode 1 when the URL names a component the project lost', async () => {
      selectComponents(['deleted-component']);

      await renderPage();

      expect(enabledArgOf(mockUseMetrics)).toBe(true);
      expect(enabledArgOf(mockUseProjectMetrics)).toBe(false);
      expect(screen.getByTestId('graph-cpu')).toBeInTheDocument();
    });
  });

  describe('mode 2 — components selected', () => {
    beforeEach(() => {
      selectComponents(['api', 'worker']);
      mockUseProjectMetrics.mockReturnValue({
        metrics: breakdownMetrics,
        loading: false,
        isRefetching: false,
        error: undefined,
        refresh: jest.fn(),
      });
    });

    it('fans out over the selection and gates the aggregate off', async () => {
      await renderPage();

      expect(mockUseProjectMetrics).toHaveBeenCalledWith(
        expect.anything(),
        ['api', 'worker'],
        'dev-ns',
        'url-shortener',
        'resource',
        true,
      );
      expect(enabledArgOf(mockUseMetrics)).toBe(false);
    });

    it('renders the per-component charts and HTTP section', async () => {
      await renderPage();

      expect(screen.getByTestId('project-graph-cpu')).toHaveAttribute(
        'data-components',
        'api,worker',
      );
      // usage + requests + limits for each of the two components
      expect(screen.getByTestId('project-graph-cpu')).toHaveAttribute(
        'data-series-count',
        '6',
      );
      expect(screen.getByTestId('project-graph-memory')).toBeInTheDocument();
      expect(screen.getByTestId('project-http-section')).toHaveAttribute(
        'data-components',
        'api,worker',
      );
      expect(screen.queryByTestId('graph-cpu')).not.toBeInTheDocument();
    });

    it('renders the surviving charts and names the failures (E9)', async () => {
      mockUseProjectMetrics.mockReturnValue({
        metrics: {
          byComponent: { api: aggregateMetrics },
          failedComponents: [{ name: 'worker', error: 'nope' }],
        },
        loading: false,
        isRefetching: false,
        error: undefined,
        refresh: jest.fn(),
      });

      await renderPage();

      expect(screen.getByTestId('project-graph-cpu')).toHaveAttribute(
        'data-components',
        'api',
      );
      expect(screen.getByText(/No metrics for worker/)).toBeInTheDocument();
    });

    it('shows the fan-out error, not the aggregate one', async () => {
      mockUseProjectMetrics.mockReturnValue({
        metrics: undefined,
        loading: false,
        isRefetching: false,
        error: 'Fan-out failed',
        refresh: jest.fn(),
      });

      await renderPage();

      expect(screen.getByText('Fan-out failed')).toBeInTheDocument();
    });
  });

  describe('permission and status gates', () => {
    it('shows a fullpage ForbiddenState without project metrics permission (E12)', async () => {
      mockUseMetricsPermission.mockReturnValue({
        canViewMetrics: false,
        loading: false,
        deniedTooltip: 'No metrics access',
        permissionName: 'openchoreo.metrics.view',
      });

      await renderPage();

      expect(
        screen.getByTestId('forbidden-state-fullpage'),
      ).toBeInTheDocument();
      expect(screen.queryByTestId('metrics-filters')).not.toBeInTheDocument();
    });

    it('shows a compact ForbiddenState and fetches nothing for a denied environment (E13)', async () => {
      mockUseMetricsPermission.mockImplementation((environmentName?: string) =>
        environmentName
          ? {
              canViewMetrics: false,
              loading: false,
              deniedTooltip: 'No access to development',
              permissionName: 'openchoreo.metrics.view',
            }
          : {
              canViewMetrics: true,
              loading: false,
              deniedTooltip: '',
              permissionName: '',
            },
      );

      await renderPage();

      expect(screen.getByTestId('forbidden-state-compact')).toBeInTheDocument();
      expect(enabledArgOf(mockUseMetrics)).toBe(false);
      expect(enabledArgOf(mockUseProjectMetrics)).toBe(false);
      expect(screen.queryByTestId('graph-cpu')).not.toBeInTheDocument();
    });

    it('shows only the notice when environments are unusable (E14)', async () => {
      mockUseProjectEnvironments.mockReturnValue({
        environments: [],
        loading: false,
        status: 'empty',
        error: null,
      });

      await renderPage();

      expect(screen.queryByTestId('metrics-filters')).not.toBeInTheDocument();
      expect(screen.queryByTestId('graph-cpu')).not.toBeInTheDocument();
    });

    it('shows a spinner while environments load', async () => {
      mockUseProjectEnvironments.mockReturnValue({
        environments: [],
        loading: true,
        status: 'ok',
        error: null,
      });

      await renderPage();

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('empty and degraded projects', () => {
    it('still charts the aggregate for a project with no components (E1)', async () => {
      mockUseGetComponentsByProject.mockReturnValue({
        components: [],
        loading: false,
        error: null,
      });

      await renderPage();

      expect(screen.getByTestId('graph-cpu')).toBeInTheDocument();
      expect(
        screen.queryByText('No components in this project.'),
      ).not.toBeInTheDocument();
    });

    it('says the project is empty only when the aggregate is empty too', async () => {
      mockUseGetComponentsByProject.mockReturnValue({
        components: [],
        loading: false,
        error: null,
      });
      mockUseMetrics.mockReturnValue({
        metrics: {
          cpuUsage: { cpuUsage: [], cpuRequests: [], cpuLimits: [] },
          memoryUsage: {
            memoryUsage: [],
            memoryRequests: [],
            memoryLimits: [],
          },
        },
        loading: false,
        isRefetching: false,
        error: null,
        fetchMetrics: jest.fn(),
        refresh: jest.fn(),
      });

      await renderPage();

      expect(
        screen.getByText('No components in this project.'),
      ).toBeInTheDocument();
    });

    it('treats a disabled project as info, not an error (E10)', async () => {
      mockUseMetrics.mockReturnValue({
        metrics: null,
        loading: false,
        isRefetching: false,
        error: 'Observability is not enabled for this component',
        fetchMetrics: jest.fn(),
        refresh: jest.fn(),
      });

      await renderPage();

      expect(
        screen.getByText(
          'Observability is not enabled for this project in the current environment. Enable observability to view metrics.',
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText('Retry')).not.toBeInTheDocument();
    });

    it('offers Retry on a plain fetch error', async () => {
      const refresh = jest.fn();
      mockUseMetrics.mockReturnValue({
        metrics: null,
        loading: false,
        isRefetching: false,
        error: 'Metrics query failed',
        fetchMetrics: jest.fn(),
        refresh,
      });

      await renderPage();
      await userEvent.click(screen.getByText('Retry'));

      expect(refresh).toHaveBeenCalled();
    });

    it('renders the components error instead of the charts', async () => {
      mockUseGetComponentsByProject.mockReturnValue({
        components: [],
        loading: false,
        error: 'Failed to list components',
      });

      await renderPage();

      expect(screen.getByText('Failed to list components')).toBeInTheDocument();
      expect(screen.queryByTestId('graph-cpu')).not.toBeInTheDocument();
    });
  });

  it('keeps the charts mounted while a refresh is in flight', async () => {
    mockUseMetrics.mockReturnValue({
      metrics: aggregateMetrics,
      loading: false,
      isRefetching: true,
      error: null,
      fetchMetrics: jest.fn(),
      refresh: jest.fn(),
    });

    await renderPage();

    expect(screen.getByTestId('graph-cpu')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('passes the project components to the filter bar', async () => {
    await renderPage();

    expect(screen.getByTestId('component-count')).toHaveTextContent('2');
  });

  it('refreshes the active mode when the refresh button is clicked', async () => {
    const refresh = jest.fn();
    mockUseMetrics.mockReturnValue({
      metrics: aggregateMetrics,
      loading: false,
      isRefetching: false,
      error: null,
      fetchMetrics: jest.fn(),
      refresh,
    });

    await renderPage();
    await userEvent.click(screen.getByTestId('refresh-btn'));

    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
