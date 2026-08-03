import { screen } from '@testing-library/react';
import { renderInTestApp } from '@backstage/test-utils';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { ObservabilityProjectIncidentsPage } from './ObservabilityProjectIncidentsPage';

// ---- Mocks (own hooks and child components only) ----

const mockUseIncidentsPermission = jest.fn();
const mockUseProjectEnvironments = jest.fn();
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useIncidentsPermission: () => mockUseIncidentsPermission(),
  useProjectEnvironments: (...args: any[]) =>
    mockUseProjectEnvironments(...args),
}));

const mockUseGetComponentsByProject = jest.fn();
const mockUseProjectIncidents = jest.fn();
const mockUseUrlFiltersForIncidents = jest.fn();
const mockUseUpdateIncident = jest.fn();

jest.mock('../../hooks', () => ({
  useGetComponentsByProject: (...args: any[]) =>
    mockUseGetComponentsByProject(...args),
  useProjectIncidents: (...args: any[]) => mockUseProjectIncidents(...args),
  useUrlFiltersForIncidents: (...args: any[]) =>
    mockUseUrlFiltersForIncidents(...args),
  useUpdateIncident: () => mockUseUpdateIncident(),
}));

jest.mock('./IncidentsFilter', () => ({
  IncidentsFilter: ({ environments, filters }: any) => (
    <div data-testid="incidents-filter">
      <span data-testid="env-count">{environments.length}</span>
      <span data-testid="filter-time">{filters.timeRange}</span>
    </div>
  ),
}));

jest.mock('./IncidentsActions', () => ({
  IncidentsActions: ({ totalCount, onRefresh, disabled }: any) => (
    <div data-testid="incidents-actions">
      <span data-testid="total-count">{totalCount}</span>
      <button data-testid="refresh-btn" onClick={onRefresh} disabled={disabled}>
        Refresh
      </button>
    </div>
  ),
}));

jest.mock('./IncidentsTable', () => ({
  IncidentsTable: ({ incidents, loading }: any) => (
    <div data-testid="incidents-table">
      <span data-testid="incident-count">{incidents.length}</span>
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
    namespace: 'default',
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
  mockUseIncidentsPermission.mockReturnValue({
    canViewIncidents: true,
    loading: false,
    deniedTooltip: '',
  });

  mockUseProjectEnvironments.mockReturnValue({
    environments: [defaultEnvironment],
    loading: false,
    status: 'ok',
    error: null,
    refetch: jest.fn(),
  });

  mockUseGetComponentsByProject.mockReturnValue({
    components: [{ name: 'api-svc', displayName: 'API Service' }],
    loading: false,
    error: null,
  });

  mockUseUrlFiltersForIncidents.mockReturnValue({
    filters: {
      environment: 'development',
      timeRange: '1h',
    },
    updateFilters: jest.fn(),
  });

  mockUseProjectIncidents.mockReturnValue({
    incidents: [],
    loading: false,
    error: null,
    fetchIncidents: jest.fn(),
    refresh: jest.fn(),
  });

  mockUseUpdateIncident.mockReturnValue({
    updateIncident: jest.fn(),
  });
}

function renderPage() {
  return renderInTestApp(
    <EntityProvider entity={defaultEntity}>
      <ObservabilityProjectIncidentsPage />
    </EntityProvider>,
  );
}

// ---- Tests ----

describe('ObservabilityProjectIncidentsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  it('shows progress while checking permissions', async () => {
    mockUseIncidentsPermission.mockReturnValue({
      canViewIncidents: false,
      loading: true,
      deniedTooltip: '',
    });

    await renderPage();

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows permission denied when user lacks permission', async () => {
    mockUseIncidentsPermission.mockReturnValue({
      canViewIncidents: false,
      loading: false,
      deniedTooltip: 'No incidents access',
    });

    await renderPage();

    expect(screen.getByText('Permission Denied')).toBeInTheDocument();
  });

  it('renders filter, actions, and table when permitted', async () => {
    await renderPage();

    expect(screen.getByTestId('incidents-filter')).toBeInTheDocument();
    expect(screen.getByTestId('incidents-actions')).toBeInTheDocument();
    expect(screen.getByTestId('incidents-table')).toBeInTheDocument();
  });

  it('passes environments to filter', async () => {
    await renderPage();

    expect(screen.getByTestId('env-count')).toHaveTextContent('1');
  });

  it('shows info message when observability is disabled', async () => {
    mockUseProjectIncidents.mockReturnValue({
      incidents: [],
      loading: false,
      error: 'Observability is not enabled for this project',
      fetchIncidents: jest.fn(),
      refresh: jest.fn(),
    });

    await renderPage();

    expect(
      screen.getByText(
        'Observability is not enabled for this project. Enable observability to view incidents.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();
  });

  it('shows incidents error with Retry button', async () => {
    mockUseProjectIncidents.mockReturnValue({
      incidents: [],
      loading: false,
      error: 'Incidents query failed',
      fetchIncidents: jest.fn(),
      refresh: jest.fn(),
    });

    await renderPage();

    expect(screen.getByText('Incidents query failed')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('shows the empty-pipeline notice when the pipeline has no environments', async () => {
    mockUseProjectEnvironments.mockReturnValue({
      environments: [],
      loading: false,
      status: 'empty-pipeline',
      error: null,
      refetch: jest.fn(),
    });

    mockUseUrlFiltersForIncidents.mockReturnValue({
      filters: {
        environment: '',
        timeRange: '1h',
      },
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
    mockUseUrlFiltersForIncidents.mockReturnValue({
      filters: {
        environment: '',
        timeRange: '1h',
      },
      updateFilters: jest.fn(),
    });

    await renderPage();

    expect(screen.getByTestId('incidents-filter')).toBeInTheDocument();
    expect(screen.queryByTestId('incidents-actions')).not.toBeInTheDocument();
    expect(screen.queryByTestId('incidents-table')).not.toBeInTheDocument();
  });

  it('shows the pipeline-unavailable notice when environments fail to load', async () => {
    mockUseProjectEnvironments.mockReturnValue({
      environments: [],
      loading: false,
      status: 'unavailable',
      error: 'Failed to load deployment pipeline: 500 Internal Server Error',
      refetch: jest.fn(),
    });

    await renderPage();

    expect(
      screen.getByText(/Couldn't load this project's deployment pipeline/i),
    ).toBeInTheDocument();
  });

  it('renders components error', async () => {
    mockUseGetComponentsByProject.mockReturnValue({
      components: [],
      loading: false,
      error: 'Failed to fetch components',
    });

    await renderPage();

    expect(screen.getByText('Failed to fetch components')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });
});
