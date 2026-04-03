import { screen } from '@testing-library/react';
import { renderInTestApp } from '@backstage/test-utils';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { RCAPage } from './RCAPage';

// ---- Mocks (own hooks and child components only) ----

const mockUseRcaPermission = jest.fn();
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useRcaPermission: () => mockUseRcaPermission(),
  ForbiddenState: ({ message }: any) => (
    <div data-testid="forbidden-state">{message}</div>
  ),
}));

const mockUseGetEnvironmentsByNamespace = jest.fn();
const mockUseUrlFilters = jest.fn();
const mockUseRCAReports = jest.fn();

jest.mock('../../hooks', () => ({
  useGetEnvironmentsByNamespace: (...args: any[]) =>
    mockUseGetEnvironmentsByNamespace(...args),
  useUrlFilters: (...args: any[]) => mockUseUrlFilters(...args),
  useRCAReports: (...args: any[]) => mockUseRCAReports(...args),
}));

jest.mock('./RCAFilters', () => ({
  RCAFilters: ({ environments, filters }: any) => (
    <div data-testid="rca-filters">
      <span data-testid="env-count">{environments.length}</span>
      <span data-testid="filter-time">{filters.timeRange}</span>
    </div>
  ),
}));

jest.mock('./RCAActions', () => ({
  RCAActions: ({ totalCount, onRefresh, disabled }: any) => (
    <div data-testid="rca-actions">
      <span data-testid="total-count">{totalCount}</span>
      <button
        data-testid="refresh-btn"
        onClick={onRefresh}
        disabled={disabled}
      >
        Refresh
      </button>
    </div>
  ),
}));

jest.mock('./RCATable', () => ({
  RCATable: ({ reports, loading }: any) => (
    <div data-testid="rca-table">
      <span data-testid="report-count">{reports.length}</span>
      {loading && <span data-testid="table-loading" />}
    </div>
  ),
}));

jest.mock('./RCAReport', () => ({
  RCAReport: () => <div data-testid="rca-report-detail" />,
}));

jest.mock('./RCAReport/EntityLinkContext', () => ({
  EntityLinkContext: {
    Provider: ({ children }: any) => <>{children}</>,
  },
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
  mockUseRcaPermission.mockReturnValue({
    canViewRca: true,
    loading: false,
    deniedTooltip: '',
    permissionName: '',
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

  mockUseRCAReports.mockReturnValue({
    reports: [],
    loading: false,
    error: null,
    refresh: jest.fn(),
  });
}

function renderPage() {
  return renderInTestApp(
    <EntityProvider entity={defaultEntity}>
      <RCAPage />
    </EntityProvider>,
    { routeEntries: ['/'] },
  );
}

// ---- Tests ----

describe('RCAPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  it('shows progress while checking permissions', async () => {
    mockUseRcaPermission.mockReturnValue({
      canViewRca: false,
      loading: true,
      deniedTooltip: '',
      permissionName: '',
    });

    await renderPage();

    expect(screen.getByTestId('progress')).toBeInTheDocument();
  });

  it('shows forbidden state when user lacks permission', async () => {
    mockUseRcaPermission.mockReturnValue({
      canViewRca: false,
      loading: false,
      deniedTooltip: 'No RCA access',
      permissionName: 'openchoreo.rca.view',
    });

    await renderPage();

    expect(screen.getByTestId('forbidden-state')).toBeInTheDocument();
    expect(screen.getByText('No RCA access')).toBeInTheDocument();
  });

  it('renders filters, actions, and table when permitted', async () => {
    await renderPage();

    expect(screen.getByTestId('rca-filters')).toBeInTheDocument();
    expect(screen.getByTestId('rca-actions')).toBeInTheDocument();
    expect(screen.getByTestId('rca-table')).toBeInTheDocument();
  });

  it('passes environments to filters', async () => {
    await renderPage();

    expect(screen.getByTestId('env-count')).toHaveTextContent('1');
  });

  it('passes filtered reports count to actions', async () => {
    mockUseRCAReports.mockReturnValue({
      reports: [
        { reportId: 'r1', summary: 'Report 1', status: 'completed' },
        { reportId: 'r2', summary: 'Report 2', status: 'pending' },
      ],
      loading: false,
      error: null,
      refresh: jest.fn(),
    });

    await renderPage();

    expect(screen.getByTestId('total-count')).toHaveTextContent('2');
  });

  it('shows progress when reports are loading', async () => {
    mockUseRCAReports.mockReturnValue({
      reports: [],
      loading: true,
      error: null,
      refresh: jest.fn(),
    });

    await renderPage();

    expect(screen.getByTestId('progress')).toBeInTheDocument();
  });

  it('shows info message when observability is disabled', async () => {
    mockUseRCAReports.mockReturnValue({
      reports: [],
      loading: false,
      error: 'Observability is not enabled for this environment',
      refresh: jest.fn(),
    });

    await renderPage();

    expect(
      screen.getByText(
        'Observability is not enabled for this environment. Please enable observability and enable the AI RCA agent.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();
  });

  it('shows info message when RCA service is not configured', async () => {
    mockUseRCAReports.mockReturnValue({
      reports: [],
      loading: false,
      error: 'RCA service is not configured',
      refresh: jest.fn(),
    });

    await renderPage();

    expect(
      screen.getByText(
        'AI RCA is not configured. Please enable it to view RCA reports.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();
  });

  it('shows reports error with Retry button', async () => {
    mockUseRCAReports.mockReturnValue({
      reports: [],
      loading: false,
      error: 'RCA query failed',
      refresh: jest.fn(),
    });

    await renderPage();

    expect(screen.getByText('RCA query failed')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('renders nothing for environments error', async () => {
    mockUseGetEnvironmentsByNamespace.mockReturnValue({
      environments: [],
      loading: false,
      error: 'Environment error',
    });

    await renderPage();

    expect(screen.queryByTestId('rca-filters')).not.toBeInTheDocument();
  });
});
