import { screen } from '@testing-library/react';
import { renderInTestApp } from '@backstage/test-utils';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { ObservabilityRuntimeEventsPage } from './ObservabilityRuntimeEventsPage';

// ---- Mocks (own hooks and child components only) ----

const mockUseEventsPermission = jest.fn();
const mockUseProjectEnvironments = jest.fn();
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useEventsPermission: (...args: any[]) => mockUseEventsPermission(...args),
  ForbiddenState: ({ message }: any) => (
    <div data-testid="forbidden-state">{message}</div>
  ),
  useProjectEnvironments: (...args: any[]) =>
    mockUseProjectEnvironments(...args),
}));

const mockUseGetNamespaceAndProjectByEntity = jest.fn();
const mockUseRuntimeEvents = jest.fn();
const mockUseUrlFiltersForRuntimeEvents = jest.fn();

jest.mock('../../hooks', () => ({
  useGetNamespaceAndProjectByEntity: (...args: any[]) =>
    mockUseGetNamespaceAndProjectByEntity(...args),
  useRuntimeEvents: (...args: any[]) => mockUseRuntimeEvents(...args),
  useUrlFiltersForRuntimeEvents: (...args: any[]) =>
    mockUseUrlFiltersForRuntimeEvents(...args),
}));

jest.mock('./EventsFilter', () => ({
  EventsFilter: ({ environments, filters }: any) => (
    <div data-testid="events-filter">
      <span data-testid="env-count">{environments.length}</span>
      <span data-testid="filter-env">{filters.environment}</span>
    </div>
  ),
}));

jest.mock('./EventsTable', () => ({
  EventsTable: ({ events, loading }: any) => (
    <div data-testid="events-table">
      <span data-testid="event-count">{events.length}</span>
      <span data-testid="table-loading">{String(loading)}</span>
      {events.map((event: any, i: number) => (
        <div key={i} data-testid={`event-${i}`}>
          {event.message}
        </div>
      ))}
    </div>
  ),
}));

jest.mock('./EventsActions', () => ({
  EventsActions: ({ totalCount, onRefresh }: any) => (
    <div data-testid="events-actions">
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
  selectedFields: ['Timestamp', 'Type', 'Reason', 'Object', 'Message'],
  environment: 'development',
  timeRange: '1h',
  sortOrder: 'asc' as const,
  isLive: false,
};

function renderPage() {
  return renderInTestApp(
    <EntityProvider entity={defaultEntity}>
      <ObservabilityRuntimeEventsPage />
    </EntityProvider>,
  );
}

const allowed = {
  canViewEvents: true,
  loading: false,
  deniedTooltip: '',
  permissionName: 'openchoreo.events.view',
};

function setupDefaultMocks() {
  mockUseEventsPermission.mockReturnValue(allowed);

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

  mockUseUrlFiltersForRuntimeEvents.mockReturnValue({
    filters: defaultFilters,
    updateFilters: jest.fn(),
  });

  mockUseRuntimeEvents.mockReturnValue({
    events: [
      {
        timestamp: '2024-06-01T10:00:00.000Z',
        message: 'Scaled up replica set',
        type: 'Normal',
      },
    ],
    loading: false,
    error: null,
    totalCount: 1,
    hasMore: false,
    fetchEvents: jest.fn(),
    loadMore: jest.fn(),
    refresh: jest.fn(),
  });
}

// ---- Tests ----

describe('ObservabilityRuntimeEventsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  it('shows progress while checking page-level permission', async () => {
    mockUseEventsPermission.mockReturnValue({
      ...allowed,
      canViewEvents: false,
      loading: true,
    });

    await renderPage();

    expect(screen.getByTestId('progress')).toBeInTheDocument();
  });

  it('shows the forbidden state when the user lacks permission', async () => {
    mockUseEventsPermission.mockReturnValue({
      canViewEvents: false,
      loading: false,
      deniedTooltip: 'You cannot view events',
      permissionName: 'openchoreo.events.view',
    });

    await renderPage();

    expect(screen.getByTestId('forbidden-state')).toBeInTheDocument();
    expect(screen.getByText('You cannot view events')).toBeInTheDocument();
  });

  it('renders the filter, table and actions when permitted', async () => {
    await renderPage();

    expect(screen.getByTestId('events-filter')).toBeInTheDocument();
    expect(screen.getByTestId('events-table')).toBeInTheDocument();
    expect(screen.getByTestId('events-actions')).toBeInTheDocument();
  });

  it('passes environments to EventsFilter', async () => {
    await renderPage();
    expect(screen.getByTestId('env-count')).toHaveTextContent('2');
  });

  it('renders event entries in the table', async () => {
    await renderPage();

    expect(screen.getByTestId('event-count')).toHaveTextContent('1');
    expect(screen.getByText('Scaled up replica set')).toBeInTheDocument();
  });

  it('shows the total count in actions', async () => {
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

  it('shows the events error message', async () => {
    mockUseRuntimeEvents.mockReturnValue({
      events: [],
      loading: false,
      error: 'Connection timed out',
      totalCount: 0,
      hasMore: false,
      fetchEvents: jest.fn(),
      loadMore: jest.fn(),
      refresh: jest.fn(),
    });

    await renderPage();

    expect(screen.getByText('Connection timed out')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('shows an info alert when observability is not enabled', async () => {
    mockUseRuntimeEvents.mockReturnValue({
      events: [],
      loading: false,
      error: 'Observability is not enabled for this component',
      totalCount: 0,
      hasMore: false,
      fetchEvents: jest.fn(),
      loadMore: jest.fn(),
      refresh: jest.fn(),
    });

    await renderPage();

    expect(
      screen.getByText(
        'Observability is not enabled for this component in the current environment. Enable observability to view runtime events.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();
  });

  it('shows the empty-pipeline notice when the pipeline has no environments', async () => {
    mockUseProjectEnvironments.mockReturnValue({
      environments: [],
      loading: false,
      status: 'empty-pipeline',
      error: null,
      refetch: jest.fn(),
    });
    mockUseUrlFiltersForRuntimeEvents.mockReturnValue({
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

  it('shows an env-scoped forbidden state when env permission is denied', async () => {
    mockUseEventsPermission.mockImplementation((env?: string) =>
      env
        ? {
            canViewEvents: false,
            loading: false,
            deniedTooltip: 'No access in this environment',
            permissionName: 'openchoreo.events.view',
          }
        : allowed,
    );

    await renderPage();

    expect(
      screen.getByText('No access in this environment'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('events-table')).not.toBeInTheDocument();
  });
});
