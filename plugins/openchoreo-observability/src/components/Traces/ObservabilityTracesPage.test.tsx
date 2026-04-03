import { screen } from '@testing-library/react';
import { renderInTestApp } from '@backstage/test-utils';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { ObservabilityTracesPage } from './ObservabilityTracesPage';

// ---- Mocks (own hooks and child components only) ----

const mockUseTracesPermission = jest.fn();
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useTracesPermission: () => mockUseTracesPermission(),
  ForbiddenState: ({ message }: any) => (
    <div data-testid="forbidden-state">{message}</div>
  ),
}));

const mockUseGetEnvironmentsByNamespace = jest.fn();
const mockUseGetComponentsByProject = jest.fn();
const mockUseTraces = jest.fn();
const mockUseUrlFilters = jest.fn();

jest.mock('../../hooks', () => ({
  useGetEnvironmentsByNamespace: (...args: any[]) =>
    mockUseGetEnvironmentsByNamespace(...args),
  useGetComponentsByProject: (...args: any[]) =>
    mockUseGetComponentsByProject(...args),
  useTraces: (...args: any[]) => mockUseTraces(...args),
  useUrlFilters: (...args: any[]) => mockUseUrlFilters(...args),
}));

jest.mock('../../hooks/useTraceSpans', () => ({
  useTraceSpans: () => ({
    fetchSpans: jest.fn(),
    getSpans: jest.fn(),
    isLoading: jest.fn().mockReturnValue(false),
    getError: jest.fn(),
  }),
}));

jest.mock('../../hooks/useSpanDetails', () => ({
  useSpanDetails: () => ({
    fetchSpanDetails: jest.fn(),
    getDetails: jest.fn(),
    isLoading: jest.fn().mockReturnValue(false),
    getError: jest.fn(),
  }),
}));

jest.mock('./TracesFilters', () => ({
  TracesFilters: ({ environments, filters }: any) => (
    <div data-testid="traces-filters">
      <span data-testid="env-count">{environments.length}</span>
      <span data-testid="filter-time">{filters.timeRange}</span>
    </div>
  ),
}));

jest.mock('./TracesActions', () => ({
  TracesActions: ({ totalCount, onRefresh, disabled }: any) => (
    <div data-testid="traces-actions">
      <span data-testid="total-count">{totalCount}</span>
      <button data-testid="refresh-btn" onClick={onRefresh} disabled={disabled}>
        Refresh
      </button>
    </div>
  ),
}));

jest.mock('./TracesTable', () => ({
  TracesTable: ({ traces, loading }: any) => (
    <div data-testid="traces-table">
      <span data-testid="trace-count">{traces.length}</span>
      {loading && <span data-testid="table-loading" />}
    </div>
  ),
}));

// ---- Helpers ----

const defaultEntity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'System',
  metadata: {
    name: 'my-project',
    annotations: {
      'openchoreo.io/namespace': 'dev-ns',
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

function setupDefaultMocks() {
  mockUseTracesPermission.mockReturnValue({
    canViewTraces: true,
    loading: false,
    deniedTooltip: '',
    permissionName: '',
  });

  mockUseGetEnvironmentsByNamespace.mockReturnValue({
    environments: [defaultEnvironment],
    loading: false,
    error: null,
  });

  mockUseGetComponentsByProject.mockReturnValue({
    components: [{ name: 'api-svc', displayName: 'API Service' }],
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

  mockUseTraces.mockReturnValue({
    traces: [],
    total: 0,
    loading: false,
    error: null,
    refresh: jest.fn(),
  });
}

function renderPage() {
  return renderInTestApp(
    <EntityProvider entity={defaultEntity}>
      <ObservabilityTracesPage />
    </EntityProvider>,
  );
}

// ---- Tests ----

describe('ObservabilityTracesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  it('shows progress while checking permissions', async () => {
    mockUseTracesPermission.mockReturnValue({
      canViewTraces: false,
      loading: true,
      deniedTooltip: '',
      permissionName: '',
    });

    await renderPage();

    expect(screen.getByTestId('progress')).toBeInTheDocument();
  });

  it('shows forbidden state when user lacks permission', async () => {
    mockUseTracesPermission.mockReturnValue({
      canViewTraces: false,
      loading: false,
      deniedTooltip: 'No traces access',
      permissionName: 'openchoreo.traces.view',
    });

    await renderPage();

    expect(screen.getByTestId('forbidden-state')).toBeInTheDocument();
    expect(screen.getByText('No traces access')).toBeInTheDocument();
  });

  it('renders filters, actions, and table when permitted', async () => {
    await renderPage();

    expect(screen.getByTestId('traces-filters')).toBeInTheDocument();
    expect(screen.getByTestId('traces-actions')).toBeInTheDocument();
    expect(screen.getByTestId('traces-table')).toBeInTheDocument();
  });

  it('passes environments to filters', async () => {
    await renderPage();

    expect(screen.getByTestId('env-count')).toHaveTextContent('1');
  });

  it('passes total count to actions', async () => {
    mockUseTraces.mockReturnValue({
      traces: [
        {
          traceId: 't1',
          startTime: '2024-01-01',
          endTime: '2024-01-01',
          durationNs: 1000,
          spanCount: 3,
        },
      ],
      total: 42,
      loading: false,
      error: null,
      refresh: jest.fn(),
    });

    await renderPage();

    expect(screen.getByTestId('total-count')).toHaveTextContent('42');
  });

  it('shows progress when traces are loading', async () => {
    mockUseTraces.mockReturnValue({
      traces: [],
      total: 0,
      loading: true,
      error: null,
      refresh: jest.fn(),
    });

    await renderPage();

    expect(screen.getByTestId('progress')).toBeInTheDocument();
  });

  it('shows traces error with Retry button', async () => {
    mockUseTraces.mockReturnValue({
      traces: [],
      total: 0,
      loading: false,
      error: 'Traces query failed',
      refresh: jest.fn(),
    });

    await renderPage();

    expect(screen.getByText('Traces query failed')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('shows info message when observability is disabled', async () => {
    mockUseTraces.mockReturnValue({
      traces: [],
      total: 0,
      loading: false,
      error: 'Observability is not enabled for this component',
      refresh: jest.fn(),
    });

    await renderPage();

    expect(
      screen.getByText(
        'Observability is not enabled for this project in this environment. Please enable observability to view traces',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();
  });

  it('renders nothing for environments error', async () => {
    mockUseGetEnvironmentsByNamespace.mockReturnValue({
      environments: [],
      loading: false,
      error: 'Environment error',
    });

    await renderPage();

    expect(screen.queryByTestId('traces-filters')).not.toBeInTheDocument();
  });

  it('renders nothing for components error', async () => {
    mockUseGetComponentsByProject.mockReturnValue({
      components: [],
      loading: false,
      error: 'Components error',
    });

    await renderPage();

    expect(screen.queryByTestId('traces-filters')).not.toBeInTheDocument();
  });
});
