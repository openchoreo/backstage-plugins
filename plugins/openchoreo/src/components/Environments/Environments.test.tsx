import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { mockComponentEntity } from '@openchoreo/test-utils';
import { Environments } from './Environments';

// ---- Mocks ----

// Mock useNotification
jest.mock('../../hooks', () => ({
  useNotification: () => ({
    notification: null,
    showSuccess: jest.fn(),
    showError: jest.fn(),
  }),
}));

// Mock useEnvironmentData
const mockRefetch = jest.fn();
const mockUseEnvironmentData = jest.fn();
jest.mock('./hooks', () => ({
  useEnvironmentData: (...args: any[]) => mockUseEnvironmentData(...args),
  useStaleEnvironments: (environments: any[]) => ({
    displayEnvironments: environments,
    isPending: false,
  }),
  useEnvironmentPolling: jest.fn(),
  useAutoDeploy: () => ({
    autoDeploy: false,
    latestReleaseName: null,
    loading: false,
    refetch: jest.fn(),
    setAutoDeployOptimistic: jest.fn(),
  }),
  useAwaitNewRelease: () => ({
    awaitingNewRelease: false,
    beginAwaitingNewRelease: jest.fn(),
  }),
  useEnvironmentRouting: () => ({
    state: { view: 'list' as const },
    navigateToList: jest.fn(),
    navigateToWorkloadConfig: jest.fn(),
    navigateToOverrides: jest.fn(),
    navigateToReleaseDetails: jest.fn(),
    goBack: jest.fn(),
  }),
}));

// Mock @backstage/core-components
jest.mock('@backstage/core-components', () => ({
  Progress: () => <div data-testid="progress">Loading...</div>,
}));

// Mock permission + assistant hooks from @openchoreo/backstage-plugin-react
const mockUseEnvironmentReadPermission = jest.fn();
const mockUseReleaseBindingPermission = jest.fn();
const mockUsePortalAssistant = jest.fn();
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useEnvironmentReadPermission: () => mockUseEnvironmentReadPermission(),
  useReleaseBindingPermission: () => mockUseReleaseBindingPermission(),
  usePortalAssistant: () => mockUsePortalAssistant(),
  ForbiddenState: (props: any) => (
    <div data-testid="forbidden-state">
      <span>{props.message}</span>
      {props.onRetry && (
        <button onClick={props.onRetry} type="button">
          Retry
        </button>
      )}
    </div>
  ),
}));

// Mock the EnvironmentsRouter (renders child views). The probe also renders
// whatever investigate action reached the context, so tests can assert the
// prop/API precedence without the real detail panel.
jest.mock('./EnvironmentsRouter', () => {
  const { useEnvironmentsContext } = jest.requireActual(
    './EnvironmentsContext',
  );
  return {
    EnvironmentsRouter: () => {
      const { renderInvestigateAction } = useEnvironmentsContext();
      return (
        <div data-testid="environments-router">
          Environments Content
          {renderInvestigateAction?.({
            component: 'checkout',
            caseType: 'runtime_debug',
            status: 'Failed',
          }) ?? null}
        </div>
      );
    },
  };
});

// Mock NotificationBanner
jest.mock('./components', () => ({
  NotificationBanner: () => null,
}));

// ---- Helpers ----

const testEntity = mockComponentEntity();

function renderWithRouter(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <EntityProvider entity={testEntity}>{ui}</EntityProvider>
    </MemoryRouter>,
  );
}

// ---- Tests ----

describe('Environments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseEnvironmentReadPermission.mockReturnValue({
      canViewEnvironments: true,
      loading: false,
      deniedTooltip: '',
      permissionName: 'openchoreo.environment.read',
    });
    mockUseReleaseBindingPermission.mockReturnValue({
      canViewBindings: true,
      loading: false,
    });
    mockUsePortalAssistant.mockReturnValue({});
  });

  it('mounts the router during initial load instead of a generic spinner', () => {
    mockUseEnvironmentData.mockReturnValue({
      environments: [],
      loading: true,
      isRefetching: false,
      isForbidden: false,
      refetch: mockRefetch,
    });

    renderWithRouter(<Environments />);

    // The old code returned a <Progress /> spinner here, hiding the
    // router entirely. We now let the provider + router mount so
    // PipelineCanvas can render its own LHS/RHS skeletons (covered in
    // PipelineCanvas.test.tsx).
    expect(screen.queryByTestId('progress')).not.toBeInTheDocument();
    expect(screen.getByTestId('environments-router')).toBeInTheDocument();
  });

  it('renders environments content when data loads', async () => {
    mockUseEnvironmentData.mockReturnValue({
      environments: [
        {
          name: 'development',
          deployment: { status: 'Ready' },
          endpoints: [],
        },
      ],
      loading: false,
      isRefetching: false,
      isForbidden: false,
      refetch: mockRefetch,
    });

    renderWithRouter(<Environments />);

    await waitFor(() => {
      expect(screen.getByTestId('environments-router')).toBeInTheDocument();
    });
    expect(screen.getByText('Environments Content')).toBeInTheDocument();
  });

  it('falls back to the assistant integration API for the investigate action', async () => {
    mockUsePortalAssistant.mockReturnValue({
      renderInvestigateAction: () => <button type="button">from-api</button>,
    });
    mockUseEnvironmentData.mockReturnValue({
      environments: [],
      loading: false,
      isRefetching: false,
      isForbidden: false,
      refetch: mockRefetch,
    });

    renderWithRouter(<Environments />);

    await waitFor(() => {
      expect(screen.getByText('from-api')).toBeInTheDocument();
    });
  });

  it('prefers an explicit investigate-action prop over the API slot', async () => {
    mockUsePortalAssistant.mockReturnValue({
      renderInvestigateAction: () => <button type="button">from-api</button>,
    });
    mockUseEnvironmentData.mockReturnValue({
      environments: [],
      loading: false,
      isRefetching: false,
      isForbidden: false,
      refetch: mockRefetch,
    });

    renderWithRouter(
      <Environments
        renderInvestigateAction={() => <button type="button">from-prop</button>}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('from-prop')).toBeInTheDocument();
    });
    expect(screen.queryByText('from-api')).not.toBeInTheDocument();
  });

  it('provides no investigate action when no assistant is registered', async () => {
    mockUseEnvironmentData.mockReturnValue({
      environments: [],
      loading: false,
      isRefetching: false,
      isForbidden: false,
      refetch: mockRefetch,
    });

    renderWithRouter(<Environments />);

    await waitFor(() => {
      expect(screen.getByTestId('environments-router')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows forbidden state when API returns forbidden', () => {
    mockUseEnvironmentData.mockReturnValue({
      environments: [],
      loading: false,
      isForbidden: true,
      refetch: mockRefetch,
    });

    renderWithRouter(<Environments />);

    expect(screen.getByTestId('forbidden-state')).toBeInTheDocument();
    expect(
      screen.getByText('You do not have permission to view deployments.'),
    ).toBeInTheDocument();
  });
});
