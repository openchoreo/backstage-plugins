import { render, screen } from '@testing-library/react';
import { ObservabilityRuntimeLogsPage } from './ObservabilityRuntimeLogsPage';

// ---- Mocks ----

const mockUseLogsPermission = jest.fn();
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useLogsPermission: () => mockUseLogsPermission(),
  useInfiniteScroll: () => ({ loadingRef: { current: null } }),
  ForbiddenState: ({ message }: any) => (
    <div data-testid="forbidden-state">{message}</div>
  ),
}));

jest.mock('@backstage/core-components', () => ({
  Progress: () => <div data-testid="progress" />,
}));

const mockUseEntity = jest.fn();
jest.mock('@backstage/plugin-catalog-react', () => ({
  useEntity: () => mockUseEntity(),
}));

const mockUseGetNamespaceAndProjectByEntity = jest.fn();
const mockUseGetEnvironmentsByNamespace = jest.fn();
const mockUseRuntimeLogs = jest.fn();
const mockUseUrlFiltersForRuntimeLogs = jest.fn();

jest.mock('../../hooks', () => ({
  useGetNamespaceAndProjectByEntity: (...args: any[]) =>
    mockUseGetNamespaceAndProjectByEntity(...args),
  useGetEnvironmentsByNamespace: (...args: any[]) =>
    mockUseGetEnvironmentsByNamespace(...args),
  useRuntimeLogs: (...args: any[]) => mockUseRuntimeLogs(...args),
  useUrlFiltersForRuntimeLogs: (...args: any[]) =>
    mockUseUrlFiltersForRuntimeLogs(...args),
}));

jest.mock('./LogsFilter', () => ({
  LogsFilter: ({ environments, filters }: any) => (
    <div data-testid="logs-filter">
      <span data-testid="env-count">{environments.length}</span>
      <span data-testid="filter-env">{filters.environmentId}</span>
    </div>
  ),
}));

jest.mock('./LogsTable', () => ({
  LogsTable: ({ logs, loading }: any) => (
    <div data-testid="logs-table">
      <span data-testid="log-count">{logs.length}</span>
      <span data-testid="table-loading">{String(loading)}</span>
      {logs.map((log: any, i: number) => (
        <div key={i} data-testid={`log-${i}`}>
          {log.log}
        </div>
      ))}
    </div>
  ),
}));

jest.mock('./LogsActions', () => ({
  LogsActions: ({ totalCount, onRefresh }: any) => (
    <div data-testid="logs-actions">
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
    annotations: {
      'openchoreo.io/namespace': 'dev-ns',
      'openchoreo.io/component': 'api-service',
    },
  },
  spec: { owner: 'team-a' },
};

const defaultFilters = {
  environmentId: 'env-dev',
  logLevel: [],
  selectedFields: ['Timestamp', 'LogLevel', 'Log'],
  timeRange: '1h',
  sortOrder: 'desc' as const,
  searchQuery: '',
  isLive: false,
};

function setupDefaultMocks() {
  mockUseLogsPermission.mockReturnValue({
    canViewLogs: true,
    loading: false,
    deniedTooltip: '',
    permissionName: '',
  });

  mockUseEntity.mockReturnValue({ entity: defaultEntity });

  mockUseGetNamespaceAndProjectByEntity.mockReturnValue({
    namespace: 'dev-ns',
    project: 'my-project',
  });

  mockUseGetEnvironmentsByNamespace.mockReturnValue({
    environments: [
      { name: 'development', displayName: 'Development' },
      { name: 'staging', displayName: 'Staging' },
    ],
    loading: false,
    error: null,
  });

  mockUseUrlFiltersForRuntimeLogs.mockReturnValue({
    filters: defaultFilters,
    updateFilters: jest.fn(),
  });

  mockUseRuntimeLogs.mockReturnValue({
    logs: [
      {
        timestamp: '2024-06-01T10:00:00.000Z',
        log: 'Server started',
        level: 'INFO',
      },
    ],
    loading: false,
    error: null,
    totalCount: 1,
    hasMore: false,
    fetchLogs: jest.fn(),
    loadMore: jest.fn(),
    refresh: jest.fn(),
    componentId: 'comp-1',
    projectId: 'proj-1',
  });
}

// ---- Tests ----

describe('ObservabilityRuntimeLogsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  it('shows progress while checking permissions', () => {
    mockUseLogsPermission.mockReturnValue({
      canViewLogs: false,
      loading: true,
      deniedTooltip: '',
      permissionName: '',
    });

    render(<ObservabilityRuntimeLogsPage />);

    expect(screen.getByTestId('progress')).toBeInTheDocument();
  });

  it('shows forbidden state when user lacks permission', () => {
    mockUseLogsPermission.mockReturnValue({
      canViewLogs: false,
      loading: false,
      deniedTooltip: 'You cannot view logs',
      permissionName: 'openchoreo.logs.view',
    });

    render(<ObservabilityRuntimeLogsPage />);

    expect(screen.getByTestId('forbidden-state')).toBeInTheDocument();
    expect(screen.getByText('You cannot view logs')).toBeInTheDocument();
  });

  it('renders logs filter and table when permitted', () => {
    render(<ObservabilityRuntimeLogsPage />);

    expect(screen.getByTestId('logs-filter')).toBeInTheDocument();
    expect(screen.getByTestId('logs-table')).toBeInTheDocument();
    expect(screen.getByTestId('logs-actions')).toBeInTheDocument();
  });

  it('passes environments to LogsFilter', () => {
    render(<ObservabilityRuntimeLogsPage />);

    expect(screen.getByTestId('env-count')).toHaveTextContent('2');
  });

  it('renders log entries in the table', () => {
    render(<ObservabilityRuntimeLogsPage />);

    expect(screen.getByTestId('log-count')).toHaveTextContent('1');
    expect(screen.getByText('Server started')).toBeInTheDocument();
  });

  it('shows total count in actions', () => {
    render(<ObservabilityRuntimeLogsPage />);

    expect(screen.getByTestId('total-count')).toHaveTextContent('1');
  });

  it('shows environment error when environments fail to load', () => {
    mockUseGetEnvironmentsByNamespace.mockReturnValue({
      environments: [],
      loading: false,
      error: 'Failed to fetch environments',
    });

    render(<ObservabilityRuntimeLogsPage />);

    expect(
      screen.getByText('Failed to fetch environments'),
    ).toBeInTheDocument();
  });

  it('shows logs error message', () => {
    mockUseRuntimeLogs.mockReturnValue({
      logs: [],
      loading: false,
      error: 'Connection timed out',
      totalCount: 0,
      hasMore: false,
      fetchLogs: jest.fn(),
      loadMore: jest.fn(),
      refresh: jest.fn(),
      componentId: 'comp-1',
      projectId: 'proj-1',
    });

    render(<ObservabilityRuntimeLogsPage />);

    expect(screen.getByText('Connection timed out')).toBeInTheDocument();
  });

  it('shows info alert when observability is not enabled', () => {
    mockUseRuntimeLogs.mockReturnValue({
      logs: [],
      loading: false,
      error: 'Observability is not enabled for this component',
      totalCount: 0,
      hasMore: false,
      fetchLogs: jest.fn(),
      loadMore: jest.fn(),
      refresh: jest.fn(),
      componentId: 'comp-1',
      projectId: 'proj-1',
    });

    render(<ObservabilityRuntimeLogsPage />);

    expect(
      screen.getByText(
        'Observability is not enabled for this component in this environment. Please enable observability to view runtime logs.',
      ),
    ).toBeInTheDocument();
  });

  it('shows no environments alert when none found', () => {
    mockUseGetEnvironmentsByNamespace.mockReturnValue({
      environments: [],
      loading: false,
      error: null,
    });

    mockUseUrlFiltersForRuntimeLogs.mockReturnValue({
      filters: { ...defaultFilters, environmentId: '' },
      updateFilters: jest.fn(),
    });

    render(<ObservabilityRuntimeLogsPage />);

    expect(
      screen.getByText(
        'No environments found. Make sure your component is properly configured.',
      ),
    ).toBeInTheDocument();
  });

  it('does not render actions/table when no environment selected', () => {
    mockUseUrlFiltersForRuntimeLogs.mockReturnValue({
      filters: { ...defaultFilters, environmentId: '' },
      updateFilters: jest.fn(),
    });

    render(<ObservabilityRuntimeLogsPage />);

    expect(screen.queryByTestId('logs-actions')).not.toBeInTheDocument();
    expect(screen.queryByTestId('logs-table')).not.toBeInTheDocument();
  });

  it('shows Retry button for non-observability errors', () => {
    mockUseRuntimeLogs.mockReturnValue({
      logs: [],
      loading: false,
      error: 'Network error',
      totalCount: 0,
      hasMore: false,
      fetchLogs: jest.fn(),
      loadMore: jest.fn(),
      refresh: jest.fn(),
      componentId: 'comp-1',
      projectId: 'proj-1',
    });

    render(<ObservabilityRuntimeLogsPage />);

    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('does not show Retry button for observability disabled error', () => {
    mockUseRuntimeLogs.mockReturnValue({
      logs: [],
      loading: false,
      error: 'Observability is not enabled',
      totalCount: 0,
      hasMore: false,
      fetchLogs: jest.fn(),
      loadMore: jest.fn(),
      refresh: jest.fn(),
      componentId: 'comp-1',
      projectId: 'proj-1',
    });

    render(<ObservabilityRuntimeLogsPage />);

    expect(screen.queryByText('Retry')).not.toBeInTheDocument();
  });
});
