import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TestApiProvider } from '@backstage/test-utils';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
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
  useComponentEntityDetails: () => ({
    getEntityDetails: jest.fn().mockResolvedValue({
      componentName: 'test-component',
      projectName: 'test-project',
      namespaceName: 'test-ns',
    }),
  }),
  useBuildPermission: () => mockUseBuildPermission(),
  useAsyncOperation: (fn: any) => ({
    execute: fn,
    isLoading: false,
    error: null,
  }),
  ForbiddenState: (props: any) => (
    <div data-testid="forbidden-state">{props.message}</div>
  ),
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
          [fetchApiRef, mockFetchApi],
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
  });

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
