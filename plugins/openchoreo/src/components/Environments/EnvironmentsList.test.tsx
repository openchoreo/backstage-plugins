import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { mockComponentEntity } from '@openchoreo/test-utils';
import { EnvironmentsList } from './EnvironmentsList';
import type { Environment } from './hooks';
import type { EnvironmentCardProps, SetupCardProps } from './types';

// ---- Captured props for child components ----

let capturedEnvironmentCardProps: Map<string, EnvironmentCardProps>;
// ---- Mock: EnvironmentCard & SetupCard ----
jest.mock('./components', () => ({
  NotificationBanner: () => null,
  SetupCard: (_props: SetupCardProps) => {
    return <div data-testid="setup-card" />;
  },
  EnvironmentCard: (props: EnvironmentCardProps) => {
    capturedEnvironmentCardProps.set(props.environmentName, props);
    return <div data-testid={`env-card-${props.environmentName}`} />;
  },
}));

// ---- Mock: @openchoreo/backstage-plugin-react (EmptyState, ForbiddenState) ----
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  EmptyState: (props: { title: string; description: string }) => (
    <div data-testid="empty-state">
      <span>{props.title}</span>
      <span>{props.description}</span>
    </div>
  ),
  ForbiddenState: (props: { message: string; onRetry?: () => void }) => (
    <div data-testid="forbidden-state">
      <span>{props.message}</span>
    </div>
  ),
}));

// ---- Mock: @openchoreo/backstage-design-system ----
jest.mock('@openchoreo/backstage-design-system', () => ({
  Card: ({ children, ...rest }: any) => (
    <div data-testid="design-card" {...rest}>
      {children}
    </div>
  ),
}));

// ---- Mock: useEnvironmentsContext ----
interface MockContextValue {
  environments: Environment[];
  displayEnvironments: Environment[];
  loading: boolean;
  refetch: jest.Mock;
  lowestEnvironment: string;
  isWorkloadEditorSupported: boolean;
  onPendingActionComplete: jest.Mock;
  canViewEnvironments: boolean;
  environmentReadPermissionLoading: boolean;
  canViewBindings: boolean;
  bindingsPermissionLoading: boolean;
}

let mockContextValue: MockContextValue;

const defaultMockContext = (): MockContextValue => ({
  environments: [],
  displayEnvironments: [],
  loading: false,
  refetch: jest.fn(),
  lowestEnvironment: 'development',
  isWorkloadEditorSupported: true,
  onPendingActionComplete: jest.fn(),
  canViewEnvironments: true,
  environmentReadPermissionLoading: false,
  canViewBindings: true,
  bindingsPermissionLoading: false,
});

jest.mock('./EnvironmentsContext', () => ({
  useEnvironmentsContext: () => mockContextValue,
}));

// ---- Action handler mocks (declared before jest.mock hoisting) ----
const mockNavigateToWorkloadConfig = jest.fn();
const mockNavigateToOverrides = jest.fn();
const mockNavigateToReleaseDetails = jest.fn();
const mockHandleRefreshEnvironment = jest.fn().mockResolvedValue(undefined);
const mockHandleUndeploy = jest.fn().mockResolvedValue(undefined);
const mockHandleRedeploy = jest.fn().mockResolvedValue(undefined);
const mockShowError = jest.fn();

// ---- Mock: useEnvironmentRouting ----
jest.mock('./hooks', () => ({
  useEnvironmentRouting: () => ({
    state: { view: 'list' as const },
    navigateToList: jest.fn(),
    navigateToWorkloadConfig: mockNavigateToWorkloadConfig,
    navigateToOverrides: mockNavigateToOverrides,
    navigateToReleaseDetails: mockNavigateToReleaseDetails,
    goBack: jest.fn(),
  }),
  useEnvironmentActions: () => ({
    handleRefreshEnvironment: mockHandleRefreshEnvironment,
    handlePromote: jest.fn(),
    handleUndeploy: mockHandleUndeploy,
    handleRedeploy: mockHandleRedeploy,
  }),
  isAlreadyPromoted: () => false,
}));

// ---- Mock: useIncidentsSummary ----
jest.mock('./hooks/useIncidentsSummary', () => ({
  useIncidentsSummary: () => new Map(),
}));

// ---- Mock: useItemActionTracker & useNotification ----
jest.mock('../../hooks', () => ({
  useItemActionTracker: () => ({
    isActive: () => false,
    withTracking: (_item: string, fn: () => Promise<any>) => fn(),
    activeItems: new Set(),
    startAction: jest.fn(),
    endAction: jest.fn(),
  }),
  useNotification: () => ({
    notification: null,
    showSuccess: jest.fn(),
    showError: mockShowError,
    hide: jest.fn(),
  }),
}));

// ---- Mock: errorUtils ----
jest.mock('../../utils/errorUtils', () => ({
  isForbiddenError: () => false,
  getErrorMessage: (err: unknown) =>
    err instanceof Error ? err.message : String(err),
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

function makeEnv(
  overrides: Partial<Environment> & { name: string },
): Environment {
  return {
    name: overrides.name,
    resourceName: overrides.resourceName,
    bindingName: overrides.bindingName,
    hasComponentTypeOverrides: overrides.hasComponentTypeOverrides,
    dataPlaneRef: overrides.dataPlaneRef,
    deployment: overrides.deployment ?? { status: 'Ready' },
    endpoints: overrides.endpoints ?? [],
    promotionTargets: overrides.promotionTargets,
  };
}

// ---- Tests ----

describe('EnvironmentsList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContextValue = defaultMockContext();
    capturedEnvironmentCardProps = new Map();
  });

  // 1. Empty state when no environments + canViewEnvironments: true
  it('shows empty state when no environments and user has view permission', () => {
    mockContextValue.environments = [];
    mockContextValue.displayEnvironments = [];
    mockContextValue.canViewEnvironments = true;

    renderWithRouter(<EnvironmentsList />);

    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText('No environments available')).toBeInTheDocument();
  });

  // 2. Forbidden state when canViewEnvironments: false
  it('shows forbidden state when user does not have view permission', () => {
    mockContextValue.environments = [];
    mockContextValue.displayEnvironments = [];
    mockContextValue.canViewEnvironments = false;
    mockContextValue.environmentReadPermissionLoading = false;

    renderWithRouter(<EnvironmentsList />);

    expect(screen.getByTestId('forbidden-state')).toBeInTheDocument();
    expect(
      screen.getByText(
        'You do not have permission to view deployment environments.',
      ),
    ).toBeInTheDocument();
  });

  // 3. Renders correct number of environment cards
  it('renders the correct number of environment cards', () => {
    const envs = [
      makeEnv({ name: 'development' }),
      makeEnv({ name: 'staging' }),
      makeEnv({ name: 'production' }),
    ];
    mockContextValue.environments = envs;
    mockContextValue.displayEnvironments = envs;

    renderWithRouter(<EnvironmentsList />);

    expect(screen.getByTestId('env-card-development')).toBeInTheDocument();
    expect(screen.getByTestId('env-card-staging')).toBeInTheDocument();
    expect(screen.getByTestId('env-card-production')).toBeInTheDocument();
    expect(screen.getAllByTestId(/^env-card-/)).toHaveLength(3);
  });

  // 4. Undeploy: env with bindingName + status Ready receives onSuspend
  it('provides onSuspend to EnvironmentCard for deployed environment with bindingName', () => {
    const envs = [
      makeEnv({
        name: 'development',
        bindingName: 'my-binding',
        deployment: { status: 'Ready' },
      }),
    ];
    mockContextValue.environments = envs;
    mockContextValue.displayEnvironments = envs;

    renderWithRouter(<EnvironmentsList />);

    const props = capturedEnvironmentCardProps.get('development');
    expect(props).toBeDefined();
    expect(props!.onSuspend).toBeDefined();
    expect(typeof props!.onSuspend).toBe('function');
  });

  // 5. Invoking onSuspend calls handleUndeploy with correct bindingName
  it('calls handleUndeploy with the correct bindingName when onSuspend is invoked', async () => {
    const envs = [
      makeEnv({
        name: 'development',
        bindingName: 'my-binding',
        deployment: { status: 'Ready' },
      }),
    ];
    mockContextValue.environments = envs;
    mockContextValue.displayEnvironments = envs;

    renderWithRouter(<EnvironmentsList />);

    const props = capturedEnvironmentCardProps.get('development');
    await props!.onSuspend();

    expect(mockHandleUndeploy).toHaveBeenCalledWith('my-binding');
  });

  // 6. Redeploy: env with statusReason 'ResourcesUndeployed' receives onRedeploy
  it('provides onRedeploy to EnvironmentCard for undeployed environment', () => {
    const envs = [
      makeEnv({
        name: 'development',
        bindingName: 'my-binding',
        deployment: { status: 'Ready', statusReason: 'ResourcesUndeployed' },
      }),
    ];
    mockContextValue.environments = envs;
    mockContextValue.displayEnvironments = envs;

    renderWithRouter(<EnvironmentsList />);

    const props = capturedEnvironmentCardProps.get('development');
    expect(props).toBeDefined();
    expect(props!.onRedeploy).toBeDefined();
    expect(typeof props!.onRedeploy).toBe('function');
  });

  // 7. Invoking onRedeploy calls handleRedeploy with correct bindingName
  it('calls handleRedeploy with the correct bindingName when onRedeploy is invoked', async () => {
    const envs = [
      makeEnv({
        name: 'development',
        bindingName: 'redeploy-binding',
        deployment: { status: 'Ready', statusReason: 'ResourcesUndeployed' },
      }),
    ];
    mockContextValue.environments = envs;
    mockContextValue.displayEnvironments = envs;

    renderWithRouter(<EnvironmentsList />);

    const props = capturedEnvironmentCardProps.get('development');
    await props!.onRedeploy();

    expect(mockHandleRedeploy).toHaveBeenCalledWith('redeploy-binding');
  });

  // 8. Promote: env with promotionTargets receives onPromote + promotionTargets
  it('passes promotionTargets and onPromote to EnvironmentCard', () => {
    const targets = [
      { name: 'staging', resourceName: 'staging-res' },
      { name: 'production', resourceName: 'production-res' },
    ];
    const envs = [
      makeEnv({
        name: 'development',
        deployment: { status: 'Ready', releaseName: 'release-1' },
        promotionTargets: targets,
      }),
    ];
    mockContextValue.environments = envs;
    mockContextValue.displayEnvironments = envs;

    renderWithRouter(<EnvironmentsList />);

    const props = capturedEnvironmentCardProps.get('development');
    expect(props).toBeDefined();
    expect(props!.promotionTargets).toEqual(targets);
    expect(typeof props!.onPromote).toBe('function');
  });

  // 9. Invoking onPromote navigates to overrides with PendingAction
  it('navigates to overrides with pending promote action when onPromote is invoked', async () => {
    const envs = [
      makeEnv({
        name: 'development',
        resourceName: 'dev-res',
        deployment: { status: 'Ready', releaseName: 'release-1' },
        promotionTargets: [{ name: 'staging' }],
      }),
    ];
    mockContextValue.environments = envs;
    mockContextValue.displayEnvironments = envs;

    renderWithRouter(<EnvironmentsList />);

    const props = capturedEnvironmentCardProps.get('development');
    await props!.onPromote('staging');

    expect(mockNavigateToOverrides).toHaveBeenCalledWith('staging', {
      type: 'promote',
      releaseName: 'release-1',
      sourceEnvironment: 'dev-res',
      targetEnvironment: 'staging',
    });
  });

  // 10. Settings gear: invoking onOpenOverrides calls navigateToOverrides
  it('calls navigateToOverrides with environment name when onOpenOverrides is invoked', () => {
    const envs = [
      makeEnv({
        name: 'production',
        deployment: { status: 'Ready' },
      }),
    ];
    mockContextValue.environments = envs;
    mockContextValue.displayEnvironments = envs;

    renderWithRouter(<EnvironmentsList />);

    const props = capturedEnvironmentCardProps.get('production');
    props!.onOpenOverrides();

    expect(mockNavigateToOverrides).toHaveBeenCalledWith('production');
  });

  // 12. Refresh: invoking onRefresh calls handleRefreshEnvironment
  it('calls handleRefreshEnvironment when onRefresh is invoked', () => {
    const envs = [
      makeEnv({
        name: 'staging',
        deployment: { status: 'Ready' },
      }),
    ];
    mockContextValue.environments = envs;
    mockContextValue.displayEnvironments = envs;

    renderWithRouter(<EnvironmentsList />);

    const props = capturedEnvironmentCardProps.get('staging');
    props!.onRefresh();

    expect(mockHandleRefreshEnvironment).toHaveBeenCalledWith('staging');
  });

  // 13. Permission-denied for environments hides cards and shows forbidden
  it('hides environment cards and shows forbidden state when permissions are denied', () => {
    mockContextValue.environments = [];
    mockContextValue.displayEnvironments = [];
    mockContextValue.canViewEnvironments = false;
    mockContextValue.environmentReadPermissionLoading = false;

    renderWithRouter(<EnvironmentsList />);

    expect(screen.queryAllByTestId(/^env-card-/)).toHaveLength(0);
    expect(screen.getByTestId('forbidden-state')).toBeInTheDocument();
    expect(
      screen.getByText(
        'You do not have permission to view deployment environments.',
      ),
    ).toBeInTheDocument();
  });
});
