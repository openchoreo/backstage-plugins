import { screen } from '@testing-library/react';
import { renderInTestApp } from '@backstage/test-utils';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { ObservabilityProjectRuntimeLogsPage } from './ObservabilityProjectRuntimeLogsPage';

// ---- Mocks (own hooks and child components only) ----

const mockUseLogsPermission = jest.fn();
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useLogsPermission: () => mockUseLogsPermission(),
  useInfiniteScroll: () => ({ loadingRef: { current: null } }),
  ForbiddenState: ({ message }: any) => (
    <div data-testid="forbidden-state">{message}</div>
  ),
}));

const mockUseGetEnvironmentsByNamespace = jest.fn();
const mockUseGetComponentsByProject = jest.fn();
const mockUseProjectRuntimeLogs = jest.fn();
const mockUseUrlFiltersForRuntimeLogs = jest.fn();

jest.mock('../../hooks', () => ({
  useGetEnvironmentsByNamespace: (...args: any[]) =>
    mockUseGetEnvironmentsByNamespace(...args),
  useGetComponentsByProject: (...args: any[]) =>
    mockUseGetComponentsByProject(...args),
  useProjectRuntimeLogs: (...args: any[]) => mockUseProjectRuntimeLogs(...args),
  useUrlFiltersForRuntimeLogs: (...args: any[]) =>
    mockUseUrlFiltersForRuntimeLogs(...args),
}));

jest.mock('./LogsFilter', () => ({
  LogsFilter: ({ environments, components, filters }: any) => (
    <div data-testid="logs-filter">
      <span data-testid="env-count">{environments.length}</span>
      <span data-testid="component-count">{components?.length ?? 0}</span>
      <span data-testid="filter-env">{filters.environmentId}</span>
    </div>
  ),
}));

jest.mock('./LogsTable', () => ({
  LogsTable: ({ logs, loading, selectedFields }: any) => (
    <div data-testid="logs-table">
      <span data-testid="log-count">{logs.length}</span>
      <span data-testid="table-loading">{String(loading)}</span>
      <span data-testid="field-count">{selectedFields.length}</span>
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
  kind: 'System',
  metadata: {
    name: 'my-project',
    annotations: {
      'openchoreo.io/namespace': 'dev-ns',
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
  componentIds: [],
};

function renderPage() {
  return renderInTestApp(
    <EntityProvider entity={defaultEntity}>
      <ObservabilityProjectRuntimeLogsPage />
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

  mockUseGetEnvironmentsByNamespace.mockReturnValue({
    environments: [{ name: 'development', displayName: 'Development' }],
    loading: false,
    error: null,
  });

  mockUseGetComponentsByProject.mockReturnValue({
    components: [
      { name: 'svc-a', displayName: 'Service A' },
      { name: 'svc-b', displayName: 'Service B' },
    ],
    loading: false,
    error: null,
  });

  mockUseUrlFiltersForRuntimeLogs.mockReturnValue({
    filters: defaultFilters,
    updateFilters: jest.fn(),
  });

  mockUseProjectRuntimeLogs.mockReturnValue({
    logs: [
      {
        timestamp: '2024-06-01T10:00:00.000Z',
        log: 'Project log entry 1',
        level: 'INFO',
        metadata: { componentName: 'svc-a' },
      },
      {
        timestamp: '2024-06-01T10:01:00.000Z',
        log: 'Project log entry 2',
        level: 'ERROR',
        metadata: { componentName: 'svc-b' },
      },
    ],
    loading: false,
    error: null,
    totalCount: 2,
    hasMore: false,
    fetchLogs: jest.fn(),
    loadMore: jest.fn(),
    refresh: jest.fn(),
  });
}

// ---- Tests ----

describe('ObservabilityProjectRuntimeLogsPage', () => {
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
      deniedTooltip: 'No access to project logs',
      permissionName: 'openchoreo.logs.view',
    });

    await renderPage();

    expect(screen.getByTestId('forbidden-state')).toBeInTheDocument();
    expect(screen.getByText('No access to project logs')).toBeInTheDocument();
  });

  it('renders filter, actions, and table when permitted', async () => {
    await renderPage();

    expect(screen.getByTestId('logs-filter')).toBeInTheDocument();
    expect(screen.getByTestId('logs-actions')).toBeInTheDocument();
    expect(screen.getByTestId('logs-table')).toBeInTheDocument();
  });

  it('passes environments to filter', async () => {
    await renderPage();

    expect(screen.getByTestId('env-count')).toHaveTextContent('1');
  });

  it('passes components to filter', async () => {
    await renderPage();

    expect(screen.getByTestId('component-count')).toHaveTextContent('2');
  });

  it('renders project-level log entries', async () => {
    await renderPage();

    expect(screen.getByTestId('log-count')).toHaveTextContent('2');
    expect(screen.getByText('Project log entry 1')).toBeInTheDocument();
    expect(screen.getByText('Project log entry 2')).toBeInTheDocument();
  });

  it('shows total count in actions', async () => {
    await renderPage();

    expect(screen.getByTestId('total-count')).toHaveTextContent('2');
  });

  it('shows environment error', async () => {
    mockUseGetEnvironmentsByNamespace.mockReturnValue({
      environments: [],
      loading: false,
      error: 'Environment fetch failed',
    });

    await renderPage();

    expect(screen.getByText('Environment fetch failed')).toBeInTheDocument();
  });

  it('shows components error', async () => {
    mockUseGetComponentsByProject.mockReturnValue({
      components: [],
      loading: false,
      error: 'Components fetch failed',
    });

    await renderPage();

    expect(screen.getByText('Components fetch failed')).toBeInTheDocument();
  });

  it('shows logs error message', async () => {
    mockUseProjectRuntimeLogs.mockReturnValue({
      logs: [],
      loading: false,
      error: 'Log query failed',
      totalCount: 0,
      hasMore: false,
      fetchLogs: jest.fn(),
      loadMore: jest.fn(),
      refresh: jest.fn(),
    });

    await renderPage();

    expect(screen.getByText('Log query failed')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('shows info message when observability is not enabled', async () => {
    mockUseProjectRuntimeLogs.mockReturnValue({
      logs: [],
      loading: false,
      error: 'Observability is not enabled for this project',
      totalCount: 0,
      hasMore: false,
      fetchLogs: jest.fn(),
      loadMore: jest.fn(),
      refresh: jest.fn(),
    });

    await renderPage();

    expect(
      screen.getByText(
        'Observability is not enabled for this project in this environment. Please enable observability to view runtime logs.',
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

    mockUseUrlFiltersForRuntimeLogs.mockReturnValue({
      filters: { ...defaultFilters, environmentId: '' },
      updateFilters: jest.fn(),
    });

    await renderPage();

    expect(
      screen.getByText('No environments found for this project.'),
    ).toBeInTheDocument();
  });

  it('does not render actions/table when no environment selected', async () => {
    mockUseUrlFiltersForRuntimeLogs.mockReturnValue({
      filters: { ...defaultFilters, environmentId: '' },
      updateFilters: jest.fn(),
    });

    await renderPage();

    expect(screen.queryByTestId('logs-actions')).not.toBeInTheDocument();
    expect(screen.queryByTestId('logs-table')).not.toBeInTheDocument();
  });
});
