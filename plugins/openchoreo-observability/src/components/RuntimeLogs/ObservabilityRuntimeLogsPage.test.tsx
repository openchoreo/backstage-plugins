import { screen } from '@testing-library/react';
import { renderInTestApp } from '@backstage/test-utils';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { ObservabilityRuntimeLogsPage } from './ObservabilityRuntimeLogsPage';

// ---- Mocks (own hooks and child components only) ----

const mockUseLogsPermission = jest.fn();
const mockUseProjectEnvironments = jest.fn();
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useLogsPermission: () => mockUseLogsPermission(),
  ForbiddenState: ({ message }: any) => (
    <div data-testid="forbidden-state">{message}</div>
  ),
  useProjectEnvironments: (...args: any[]) =>
    mockUseProjectEnvironments(...args),
}));

const mockUseGetNamespaceAndProjectByEntity = jest.fn();
const mockUseRuntimeLogs = jest.fn();
const mockUseUrlFiltersForRuntimeLogs = jest.fn();

jest.mock('../../hooks', () => ({
  useGetNamespaceAndProjectByEntity: (...args: any[]) =>
    mockUseGetNamespaceAndProjectByEntity(...args),
  useRuntimeLogs: (...args: any[]) => mockUseRuntimeLogs(...args),
  useUrlFiltersForRuntimeLogs: (...args: any[]) =>
    mockUseUrlFiltersForRuntimeLogs(...args),
}));

jest.mock('./LogsFilter', () => ({
  LogsFilter: ({ environments, filters }: any) => (
    <div data-testid="logs-filter">
      <span data-testid="env-count">{environments.length}</span>
      <span data-testid="filter-env">{filters.environment}</span>
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
  environment: 'env-dev',
  logLevel: [],
  selectedFields: ['Timestamp', 'LogLevel', 'Log'],
  timeRange: '1h',
  sortOrder: 'desc' as const,
  searchQuery: '',
  isLive: false,
};

function renderPage() {
  return renderInTestApp(
    <EntityProvider entity={defaultEntity}>
      <ObservabilityRuntimeLogsPage />
    </EntityProvider>,
  );
}

function setupDefaultMocks() {
  mockUseLogsPermission.mockReturnValue({
    canViewLogs: true,
    loading: false,
    deniedTooltip: '',
    permissionName: '',
  });

  mockUseGetNamespaceAndProjectByEntity.mockReturnValue({
    namespace: 'dev-ns',
    project: 'my-project',
  });

  mockUseProjectEnvironments.mockReturnValue({
    environments: [
      { name: 'development', displayName: 'Development' },
      { name: 'staging', displayName: 'Staging' },
    ],
    loading: false,
    status: 'ok',
    error: null,
    refetch: jest.fn(),
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
  });
}

// ---- Tests ----

describe('ObservabilityRuntimeLogsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  it('shows progress while checking permissions', async () => {
    mockUseLogsPermission.mockReturnValue({
      canViewLogs: false,
      loading: true,
      deniedTooltip: '',
      permissionName: '',
    });

    await renderPage();

    expect(screen.getByTestId('progress')).toBeInTheDocument();
  });

  it('shows forbidden state when user lacks permission', async () => {
    mockUseLogsPermission.mockReturnValue({
      canViewLogs: false,
      loading: false,
      deniedTooltip: 'You cannot view logs',
      permissionName: 'openchoreo.logs.view',
    });

    await renderPage();

    expect(screen.getByTestId('forbidden-state')).toBeInTheDocument();
    expect(screen.getByText('You cannot view logs')).toBeInTheDocument();
  });

  it('renders logs filter and table when permitted', async () => {
    await renderPage();

    expect(screen.getByTestId('logs-filter')).toBeInTheDocument();
    expect(screen.getByTestId('logs-table')).toBeInTheDocument();
    expect(screen.getByTestId('logs-actions')).toBeInTheDocument();
  });

  it('passes environments to LogsFilter', async () => {
    await renderPage();

    expect(screen.getByTestId('env-count')).toHaveTextContent('2');
  });

  it('renders log entries in the table', async () => {
    await renderPage();

    expect(screen.getByTestId('log-count')).toHaveTextContent('1');
    expect(screen.getByText('Server started')).toBeInTheDocument();
  });

  it('shows total count in actions', async () => {
    await renderPage();

    expect(screen.getByTestId('total-count')).toHaveTextContent('1');
  });

  it('shows the pipeline-unavailable notice when environments fail to load', async () => {
    mockUseProjectEnvironments.mockReturnValue({
      environments: [],
      loading: false,
      status: 'unavailable',
      error: 'Failed to fetch environments',
      refetch: jest.fn(),
    });

    await renderPage();

    expect(
      screen.getByText(/Couldn't load this project's deployment pipeline/i),
    ).toBeInTheDocument();
  });

  it('shows logs error message', async () => {
    mockUseRuntimeLogs.mockReturnValue({
      logs: [],
      loading: false,
      error: 'Connection timed out',
      totalCount: 0,
      hasMore: false,
      fetchLogs: jest.fn(),
      loadMore: jest.fn(),
      refresh: jest.fn(),
    });

    await renderPage();

    expect(screen.getByText('Connection timed out')).toBeInTheDocument();
  });

  it('shows info alert when observability is not enabled', async () => {
    mockUseRuntimeLogs.mockReturnValue({
      logs: [],
      loading: false,
      error: 'Observability is not enabled for this component',
      totalCount: 0,
      hasMore: false,
      fetchLogs: jest.fn(),
      loadMore: jest.fn(),
      refresh: jest.fn(),
    });

    await renderPage();

    expect(
      screen.getByText(
        'Observability is not enabled for this component in the current environment. Enable observability to view runtime logs.',
      ),
    ).toBeInTheDocument();
  });

  it('shows the empty-pipeline notice when the pipeline has no environments', async () => {
    mockUseProjectEnvironments.mockReturnValue({
      environments: [],
      loading: false,
      status: 'empty-pipeline',
      error: null,
      refetch: jest.fn(),
    });

    mockUseUrlFiltersForRuntimeLogs.mockReturnValue({
      filters: { ...defaultFilters, environment: '' },
      updateFilters: jest.fn(),
    });

    await renderPage();

    expect(
      screen.getByText(
        /This project's deployment pipeline has no environments configured/i,
      ),
    ).toBeInTheDocument();
  });

  it('does not render actions/table when no environment selected', async () => {
    mockUseUrlFiltersForRuntimeLogs.mockReturnValue({
      filters: { ...defaultFilters, environment: '' },
      updateFilters: jest.fn(),
    });

    await renderPage();

    expect(screen.queryByTestId('logs-actions')).not.toBeInTheDocument();
    expect(screen.queryByTestId('logs-table')).not.toBeInTheDocument();
  });

  it('shows Retry button for non-observability errors', async () => {
    mockUseRuntimeLogs.mockReturnValue({
      logs: [],
      loading: false,
      error: 'Network error',
      totalCount: 0,
      hasMore: false,
      fetchLogs: jest.fn(),
      loadMore: jest.fn(),
      refresh: jest.fn(),
    });

    await renderPage();

    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('does not show Retry button for observability disabled error', async () => {
    mockUseRuntimeLogs.mockReturnValue({
      logs: [],
      loading: false,
      error: 'Observability is not enabled',
      totalCount: 0,
      hasMore: false,
      fetchLogs: jest.fn(),
      loadMore: jest.fn(),
      refresh: jest.fn(),
    });

    await renderPage();

    expect(screen.queryByText('Retry')).not.toBeInTheDocument();
  });
});
