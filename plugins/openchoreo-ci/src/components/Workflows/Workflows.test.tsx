import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TestApiProvider } from '@backstage/test-utils';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { discoveryApiRef } from '@backstage/core-plugin-api';
import { openChoreoFetchApiRef } from '@openchoreo/backstage-plugin-react';
import { mockComponentEntity } from '@openchoreo/test-utils';
import { openChoreoCiClientApiRef } from '../../api/OpenChoreoCiClientApi';
import { Workflows } from './Workflows';

// ---- Mocks ----

// Mock styles (no-op)
jest.mock('./styles', () => ({
  useStyles: () => ({
    container: 'container',
    header: 'header',
    headerTitle: 'headerTitle',
    headerActions: 'headerActions',
    notFoundContainer: 'notFoundContainer',
  }),
}));

// Mock useWorkflowData, useWorkflowRouting, useWorkflowRetention
const mockUseWorkflowData = jest.fn();
const mockUseWorkflowRouting = jest.fn();
jest.mock('../../hooks', () => ({
  useWorkflowData: () => mockUseWorkflowData(),
  useWorkflowRouting: () => mockUseWorkflowRouting(),
  useWorkflowRetention: () => undefined,
  useReleaseLineWorkflowParameters: (parameters: unknown) => parameters,
}));

// Stable mock objects so useApi does not produce new references each call
const mockCiClient = {
  fetchWorkflowSchema: jest.fn().mockResolvedValue({ success: true }),
};
const mockDiscoveryApi = {
  getBaseUrl: jest.fn().mockResolvedValue('http://localhost'),
};
const mockFetchApi = {
  fetch: jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
};
const mockUseWorkflowPlaneAvailability = jest.fn();
jest.mock('@openchoreo/backstage-plugin', () => ({
  useWorkflowPlaneAvailability: () => mockUseWorkflowPlaneAvailability(),
  isWorkflowPlaneUnavailable: (status: string) =>
    status === 'missing' || status === 'disconnected',
  getWorkflowPlaneAvailabilityMessage: (availability: { status: string }) => {
    if (availability.status === 'missing') return 'Workflow plane is missing.';
    if (availability.status === 'disconnected')
      return 'Workflow plane is disconnected.';
    if (availability.status === 'loading')
      return 'Checking workflow plane availability...';
    if (availability.status === 'forbidden')
      return 'Workflow plane availability is unknown: forbidden.';
    if (availability.status === 'error')
      return 'Could not check workflow plane availability.';
    if (availability.status === 'unknown')
      return 'Workflow plane connection status is unknown.';
    return undefined;
  },
}));

// Mock @backstage/core-components
jest.mock('@backstage/core-components', () => ({
  Progress: () => <div data-testid="progress">Loading...</div>,
  ResponseErrorPanel: (props: any) => (
    <div data-testid="error-panel">{props.error?.message}</div>
  ),
  EmptyState: (props: any) => (
    <div data-testid="empty-state">
      <span>{props.title}</span>
      <span>{props.description}</span>
    </div>
  ),
}));

// Mock @openchoreo/backstage-plugin-react
const mockUseBuildPermission = jest.fn();
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  ...jest.requireActual('@openchoreo/backstage-plugin-react'),
  useComponentEntityDetails: () => ({
    getEntityDetails: jest.fn().mockResolvedValue({
      componentName: 'test-component',
      projectName: 'test-project',
      namespaceName: 'test-ns',
    }),
  }),
  useBuildPermission: () => mockUseBuildPermission(),
  useOpenChoreoMutation: (fn: any) => ({
    mutate: fn,
    isLoading: false,
    error: null,
    reset: jest.fn(),
  }),
  ForbiddenState: (props: any) => (
    <div data-testid="forbidden-state">{props.message}</div>
  ),
  // Renders nothing, like the real slot with no assistant registered.
  BuildFailureNotifierSlot: () => null,
}));

// Mock @openchoreo/backstage-plugin-common
jest.mock('@openchoreo/backstage-plugin-common', () => ({
  CHOREO_LABELS: {
    WORKFLOW_PROJECT: 'openchoreo.io/project',
    WORKFLOW_COMPONENT: 'openchoreo.io/component',
  },
  CHOREO_ANNOTATIONS: {
    NAMESPACE: 'openchoreo.io/namespace',
  },
  filterEmptyObjectProperties: (obj: any) => obj,
}));

// Mock schemaExtensions utils
jest.mock('../../utils/schemaExtensions', () => ({
  walkSchemaForGitFields: () => ({}),
}));

// Mock @openchoreo/backstage-design-system
jest.mock('@openchoreo/backstage-design-system', () => ({
  VerticalTabNav: ({ children, tabs }: any) => (
    <div data-testid="vertical-tab-nav">
      {tabs?.map((t: any) => (
        <span key={t.id} data-testid={`tab-${t.id}`}>
          {t.label}
          {t.count !== undefined && ` (${t.count})`}
        </span>
      ))}
      {children}
    </div>
  ),
  SplitButton: (props: any) => (
    <button data-testid="split-button" disabled={props.disabled}>
      Build
    </button>
  ),
  PageLoader: () => <div data-testid="progress" />,
}));

// Mock child components
jest.mock('../WorkflowConfigPage', () => ({
  WorkflowConfigPage: () => <div data-testid="config-page">Config</div>,
}));
jest.mock('../WorkflowRunDetailsPage', () => ({
  WorkflowRunDetailsPage: () => (
    <div data-testid="run-details-page">Run Details</div>
  ),
}));
jest.mock('../RunsTab', () => ({
  RunsTab: (props: any) => (
    <div data-testid="runs-tab">
      {props.builds?.length ? `${props.builds.length} build(s)` : 'No builds'}
    </div>
  ),
}));
jest.mock('../OverviewTab', () => ({
  OverviewTab: () => <div data-testid="overview-tab">Overview</div>,
}));
jest.mock('../BuildWithParamsDialog', () => ({
  BuildWithParamsDialog: () => null,
}));

// ---- Helpers ----

// Stable entity reference so the useEffect dependency on `entity` does not
// trigger infinite re-renders.
const testEntity = mockComponentEntity();

function renderWithRouter(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <TestApiProvider
        apis={[
          [openChoreoCiClientApiRef, mockCiClient],
          [discoveryApiRef, mockDiscoveryApi],
          [openChoreoFetchApiRef, mockFetchApi],
        ]}
      >
        <EntityProvider entity={testEntity}>{ui}</EntityProvider>
      </TestApiProvider>
    </MemoryRouter>,
  );
}

const defaultRoutingState = {
  state: {
    view: 'list' as const,
    tab: 'runs' as const,
    runDetailsTab: 'logs' as const,
  },
  setTab: jest.fn(),
  setRunDetailsTab: jest.fn(),
  navigateToList: jest.fn(),
  navigateToConfig: jest.fn(),
  navigateToRunDetails: jest.fn(),
  goBack: jest.fn(),
};

const defaultBuildPermission = {
  canBuild: true,
  canView: true,
  triggerLoading: false,
  viewLoading: false,
  triggerBuildDeniedTooltip: '',
  viewPermissionName: 'openchoreo.build.view',
};

// ---- Tests ----

describe('Workflows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWorkflowRouting.mockReturnValue(defaultRoutingState);
    mockUseBuildPermission.mockReturnValue(defaultBuildPermission);
    mockUseWorkflowPlaneAvailability.mockReturnValue({ status: 'connected' });
  });

  it('shows loading state when workflow data is loading', () => {
    mockUseWorkflowData.mockReturnValue({
      builds: [],
      componentDetails: null,
      loading: true,
      error: null,
      fetchBuilds: jest.fn(),
      fetchComponentDetails: jest.fn(),
    });

    renderWithRouter(<Workflows />);

    expect(screen.getByTestId('progress')).toBeInTheDocument();
  });

  it('renders workflow information with builds when loaded', () => {
    mockUseWorkflowData.mockReturnValue({
      builds: [
        {
          name: 'build-1',
          uuid: 'uuid-1',
          componentName: 'test-component',
          projectName: 'test-project',
          namespaceName: 'test-ns',
          status: 'Succeeded',
          createdAt: '2024-01-01T00:00:00Z',
        },
        {
          name: 'build-2',
          uuid: 'uuid-2',
          componentName: 'test-component',
          projectName: 'test-project',
          namespaceName: 'test-ns',
          status: 'Running',
          createdAt: '2024-01-02T00:00:00Z',
        },
      ],
      componentDetails: {
        componentWorkflow: {
          name: 'my-workflow',
          kind: 'Workflow',
          parameters: {},
        },
      },
      loading: false,
      error: null,
      fetchBuilds: jest.fn(),
      fetchComponentDetails: jest.fn(),
    });

    renderWithRouter(<Workflows />);

    // Main header should render
    expect(screen.getByText('Workflows')).toBeInTheDocument();
    // Tab nav with tabs rendered
    expect(screen.getByTestId('vertical-tab-nav')).toBeInTheDocument();
    expect(screen.getByTestId('tab-runs')).toBeInTheDocument();
    expect(screen.getByText(/Runs/)).toBeInTheDocument();
    // RunsTab receives the builds
    expect(screen.getByTestId('runs-tab')).toBeInTheDocument();
    expect(screen.getByText('2 build(s)')).toBeInTheDocument();
    // Build button should be present
    expect(screen.getByTestId('split-button')).toBeInTheDocument();
    expect(screen.getByTestId('split-button')).toBeEnabled();
  });

  it.each([
    ['missing', 'Workflow plane is missing.'],
    ['disconnected', 'Workflow plane is disconnected.'],
  ])('warns and disables builds when the plane is %s', (status, message) => {
    mockUseWorkflowPlaneAvailability.mockReturnValue({ status });
    mockUseWorkflowData.mockReturnValue({
      builds: [],
      componentDetails: {
        componentWorkflow: { name: 'my-workflow', kind: 'Workflow' },
        namespaceName: 'test-ns',
      },
      loading: false,
      error: null,
      fetchBuilds: jest.fn(),
      fetchComponentDetails: jest.fn(),
    });

    renderWithRouter(<Workflows />);

    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.getByTestId('split-button')).toBeDisabled();
  });

  it('keeps builds enabled while checking availability', () => {
    mockUseWorkflowPlaneAvailability.mockReturnValue({ status: 'loading' });
    mockUseWorkflowData.mockReturnValue({
      builds: [],
      componentDetails: {
        componentWorkflow: { name: 'my-workflow', kind: 'Workflow' },
        namespaceName: 'test-ns',
      },
      loading: false,
      error: null,
      fetchBuilds: jest.fn(),
      fetchComponentDetails: jest.fn(),
    });

    renderWithRouter(<Workflows />);

    expect(
      screen.getByText('Checking workflow plane availability...'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('split-button')).not.toBeDisabled();
  });

  it.each(['forbidden', 'error', 'unknown'])(
    'shows the distinct %s state without claiming the plane is missing or blocking builds',
    status => {
      mockUseWorkflowPlaneAvailability.mockReturnValue({ status });
      mockUseWorkflowData.mockReturnValue({
        builds: [],
        componentDetails: {
          componentWorkflow: { name: 'my-workflow', kind: 'Workflow' },
          namespaceName: 'test-ns',
        },
        loading: false,
        error: null,
        fetchBuilds: jest.fn(),
        fetchComponentDetails: jest.fn(),
      });

      renderWithRouter(<Workflows />);

      expect(screen.queryByText(/plane is missing/i)).not.toBeInTheDocument();
      let expectedMessage = /connection status is unknown/;

      if (status === 'forbidden') {
        expectedMessage = /availability is unknown: forbidden/;
      } else if (status === 'error') {
        expectedMessage = /Could not check workflow plane availability/;
      }

      expect(screen.getByText(expectedMessage)).toBeInTheDocument();
      expect(screen.getByTestId('split-button')).toBeEnabled();
    },
  );

  it('shows empty state when component has no workflow configured', () => {
    mockUseWorkflowData.mockReturnValue({
      builds: [],
      componentDetails: {
        componentWorkflow: null,
      },
      loading: false,
      error: null,
      fetchBuilds: jest.fn(),
      fetchComponentDetails: jest.fn(),
    });

    renderWithRouter(<Workflows />);

    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText('Workflows Not Available')).toBeInTheDocument();
  });

  it('shows error panel when workflow data has an error', () => {
    mockUseWorkflowData.mockReturnValue({
      builds: [],
      componentDetails: null,
      loading: false,
      error: new Error('Failed to fetch workflow data'),
      fetchBuilds: jest.fn(),
      fetchComponentDetails: jest.fn(),
    });

    renderWithRouter(<Workflows />);

    expect(screen.getByTestId('error-panel')).toBeInTheDocument();
    expect(
      screen.getByText('Failed to fetch workflow data'),
    ).toBeInTheDocument();
  });
});
