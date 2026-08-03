import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { mockComponentEntity } from '@openchoreo/test-utils';
import { PipelineCanvas } from './PipelineCanvas';
import type { Environment } from '../hooks';
import type { DeployFlowCanvasProps } from './DeployFlowCanvas';
import type { EnvironmentDetailPanelProps } from '../components';

// ---- Captured props from child components ----

let capturedFlowCanvasProps: DeployFlowCanvasProps | undefined;
let capturedDetailPanelProps: EnvironmentDetailPanelProps | undefined;

jest.mock('./DeployFlowCanvas', () => ({
  DeployFlowCanvas: (props: DeployFlowCanvasProps) => {
    capturedFlowCanvasProps = props;
    return <div data-testid="deploy-flow-canvas" />;
  },
}));

jest.mock('../components/NoEnvironmentsEmptyState', () => ({
  NoEnvironmentsEmptyState: () => <div data-testid="empty-state" />,
}));

jest.mock('../components', () => ({
  NotificationBanner: () => null,
  EnvironmentDetailPanel: (props: EnvironmentDetailPanelProps) => {
    capturedDetailPanelProps = props;
    let label = 'empty';
    if (props.selection?.kind === 'env') {
      label = `selected:${props.selection.environment.name}`;
    } else if (props.selection?.kind === 'setup') {
      label = 'selected:setup';
    }
    return <div data-testid="env-detail-panel">{label}</div>;
  },
}));

// ---- Mock @openchoreo/backstage-plugin-react primitives ----
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  ForbiddenState: (props: { message: string; onRetry?: () => void }) => (
    <div data-testid="forbidden-state">
      <span>{props.message}</span>
    </div>
  ),
}));

jest.mock('@backstage/core-components', () => ({
  EmptyState: (props: {
    missing?: string;
    title: string;
    description: any;
  }) => (
    <div data-testid={props.missing === 'data' ? 'error-state' : 'empty-state'}>
      <span>{props.title}</span>
      <span>
        {typeof props.description === 'string' ? props.description : ''}
      </span>
    </div>
  ),
}));

jest.mock('@openchoreo/backstage-design-system', () => ({
  Card: ({ children, ...rest }: any) => (
    <div data-testid="design-card" {...rest}>
      {children}
    </div>
  ),
  Skeleton: () => <span data-testid="skeleton" />,
  useChoreoTokens: () => ({
    graph: { canvasDotPattern: 'none' },
  }),
}));

// ---- Context mock ----
//
// Selection now lives on EnvironmentsContext (lifted from PipelineCanvas
// so it survives intermediate-page navigation). The mock therefore needs
// to provide stateful `selection` + `setSelection`, otherwise calling
// onSelectEnv / onSelectSetup / onClearSelection wouldn't trigger a
// re-render and downstream prop assertions wouldn't see the updated
// selection.
type Selection = { kind: 'env'; name: string } | { kind: 'setup' } | null;

interface MockContextValue {
  environments: Environment[];
  displayEnvironments: Environment[];
  loading: boolean;
  error?: Error;
  isRefetching: boolean;
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
  error: undefined,
  isRefetching: false,
  refetch: jest.fn(),
  lowestEnvironment: 'development',
  isWorkloadEditorSupported: true,
  onPendingActionComplete: jest.fn(),
  canViewEnvironments: true,
  environmentReadPermissionLoading: false,
  canViewBindings: true,
  bindingsPermissionLoading: false,
});

jest.mock('../EnvironmentsContext', () => {
  // Use require here so the mock factory can access React hooks at call time.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactLib = require('react') as typeof import('react');
  return {
    useEnvironmentsContext: () => {
      const [selection, setSelection] = ReactLib.useState<Selection>(null);
      return { ...mockContextValue, selection, setSelection };
    },
  };
});

// ---- Action mocks ----
const mockNavigateToWorkloadConfig = jest.fn();
const mockNavigateToOverrides = jest.fn();
const mockNavigateToReleaseDetails = jest.fn();
const mockHandleRefreshEnvironment = jest.fn().mockResolvedValue(undefined);
const mockHandleUndeploy = jest.fn().mockResolvedValue(undefined);
const mockHandleRedeploy = jest.fn().mockResolvedValue(undefined);
const mockHandleRolloutRestart = jest.fn().mockResolvedValue(undefined);
const mockHandleRemoveDeployment = jest.fn().mockResolvedValue(undefined);
const mockShowError = jest.fn();

jest.mock('../hooks', () => ({
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
    handleRolloutRestart: mockHandleRolloutRestart,
    handleRemoveDeployment: mockHandleRemoveDeployment,
  }),
  isAlreadyPromoted: () => false,
  computeReleaseDrift: () => ({ isBehind: false, aheadUpstreams: [] }),
  NO_DRIFT: { isBehind: false, aheadUpstreams: [] },
  getEnvironmentStatusVariant: (status?: string, statusReason?: string) => {
    if (statusReason === 'ResourcesUndeployed')
      return { variant: 'undeployed', label: 'Undeployed' };
    if (status === 'Ready') return { variant: 'active', label: 'Active' };
    if (status === 'NotReady') return { variant: 'pending', label: 'Pending' };
    if (status === 'Failed') return { variant: 'failed', label: 'Failed' };
    return { variant: 'not-deployed', label: 'Not Deployed' };
  },
}));

jest.mock('../hooks/useIncidentsSummary', () => ({
  useIncidentsSummary: () => new Map(),
}));

jest.mock('../../../hooks', () => ({
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

jest.mock('../../../utils/errorUtils', () => ({
  isForbiddenError: () => false,
  getErrorMessage: (err: unknown) =>
    err instanceof Error ? err.message : String(err),
}));

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

describe('PipelineCanvas (deploy split view)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContextValue = defaultMockContext();
    capturedFlowCanvasProps = undefined;
    capturedDetailPanelProps = undefined;
  });

  it('shows empty state when no environments and user has view permission', () => {
    renderWithRouter(<PipelineCanvas />);
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.queryByTestId('deploy-flow-canvas')).not.toBeInTheDocument();
  });

  it('shows error state (not empty state) when the fetch failed', () => {
    mockContextValue.error = new Error(
      'The deployment pipeline for project "p" could not be loaded.',
    );
    renderWithRouter(<PipelineCanvas />);
    expect(screen.getByTestId('error-state')).toBeInTheDocument();
    expect(
      screen.getByText(
        'The deployment pipeline for project "p" could not be loaded.',
      ),
    ).toBeInTheDocument();
    // The empty state must not render at the same time.
    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
    expect(screen.queryByTestId('deploy-flow-canvas')).not.toBeInTheDocument();
  });

  it('shows forbidden state when user does not have view permission', () => {
    mockContextValue.canViewEnvironments = false;
    renderWithRouter(<PipelineCanvas />);
    expect(screen.getByTestId('forbidden-state')).toBeInTheDocument();
  });

  it('renders skeletons in both panels while loading and no envs are available yet', () => {
    mockContextValue.loading = true;
    mockContextValue.environments = [];
    mockContextValue.displayEnvironments = [];

    renderWithRouter(<PipelineCanvas />);

    expect(screen.getByTestId('canvas-skeleton')).toBeInTheDocument();
    expect(screen.getByTestId('detail-panel-skeleton')).toBeInTheDocument();
    // Empty/forbidden state cards must not render simultaneously.
    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
    expect(screen.queryByTestId('forbidden-state')).not.toBeInTheDocument();
    // Real split view shouldn't render either.
    expect(screen.queryByTestId('deploy-flow-canvas')).not.toBeInTheDocument();
  });

  it('does not render skeletons once envs are loaded', () => {
    const envs = [makeEnv({ name: 'development' })];
    mockContextValue.environments = envs;
    mockContextValue.displayEnvironments = envs;

    renderWithRouter(<PipelineCanvas />);

    expect(screen.queryByTestId('canvas-skeleton')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('detail-panel-skeleton'),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('deploy-flow-canvas')).toBeInTheDocument();
  });

  it('forwards isRefetching to the canvas (keeping content) on a background refresh', () => {
    const envs = [makeEnv({ name: 'development' })];
    mockContextValue.environments = envs;
    mockContextValue.displayEnvironments = envs;
    mockContextValue.isRefetching = true;

    renderWithRouter(<PipelineCanvas />);

    // Content stays mounted (no skeleton) and the canvas is told to refresh —
    // it renders the overlay in its own top-right (covered in DeployFlowCanvas).
    expect(screen.getByTestId('deploy-flow-canvas')).toBeInTheDocument();
    expect(screen.queryByTestId('canvas-skeleton')).not.toBeInTheDocument();
    expect(capturedFlowCanvasProps?.isRefetching).toBe(true);
  });

  it('does not flag isRefetching to the canvas when not refetching', () => {
    const envs = [makeEnv({ name: 'development' })];
    mockContextValue.environments = envs;
    mockContextValue.displayEnvironments = envs;
    mockContextValue.isRefetching = false;

    renderWithRouter(<PipelineCanvas />);

    expect(capturedFlowCanvasProps?.isRefetching).toBe(false);
  });

  it('renders the split view and auto-selects the first active env when envs exist', () => {
    const envs = [
      makeEnv({ name: 'development' }),
      makeEnv({ name: 'staging' }),
    ];
    mockContextValue.environments = envs;
    mockContextValue.displayEnvironments = envs;

    renderWithRouter(<PipelineCanvas />);

    expect(screen.getByTestId('deploy-flow-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('env-detail-panel')).toBeInTheDocument();
    expect(capturedFlowCanvasProps?.environments).toHaveLength(2);
    // Both envs default to a Ready deployment, so the first one is selected.
    expect(capturedFlowCanvasProps?.selectedEnvName).toBe('development');
    expect(capturedFlowCanvasProps?.selectedSetup).toBe(false);
    const panelSelection = capturedDetailPanelProps?.selection;
    expect(panelSelection?.kind).toBe('env');
    expect(
      panelSelection?.kind === 'env' ? panelSelection.environment.name : null,
    ).toBe('development');
  });

  it('passes selection.kind=setup to the panel when Setup is selected on the canvas', () => {
    const envs = [makeEnv({ name: 'staging' })];
    mockContextValue.environments = envs;
    mockContextValue.displayEnvironments = envs;

    renderWithRouter(<PipelineCanvas />);

    act(() => {
      capturedFlowCanvasProps?.onSelectSetup();
    });
    expect(capturedDetailPanelProps?.selection).toEqual({ kind: 'setup' });
    expect(capturedFlowCanvasProps?.selectedSetup).toBe(true);
  });

  it('clears selection when onClearSelection fires from the canvas', () => {
    const envs = [makeEnv({ name: 'staging' })];
    mockContextValue.environments = envs;
    mockContextValue.displayEnvironments = envs;

    renderWithRouter(<PipelineCanvas />);

    act(() => {
      capturedFlowCanvasProps?.onSelectEnv('staging');
    });
    expect(capturedDetailPanelProps?.selection?.kind).toBe('env');

    act(() => {
      capturedFlowCanvasProps?.onClearSelection();
    });
    expect(capturedDetailPanelProps?.selection).toBeNull();
  });

  it('passes hasAnyDeployedEnv=true to the panel when at least one env has a binding', () => {
    const envs = [
      makeEnv({ name: 'dev', bindingName: 'dev-binding' }),
      makeEnv({ name: 'staging' }),
    ];
    mockContextValue.environments = envs;
    mockContextValue.displayEnvironments = envs;

    renderWithRouter(<PipelineCanvas />);

    expect(capturedDetailPanelProps?.hasAnyDeployedEnv).toBe(true);
  });

  it('passes hasAnyDeployedEnv=false when no env has a binding', () => {
    const envs = [makeEnv({ name: 'dev' }), makeEnv({ name: 'staging' })];
    mockContextValue.environments = envs;
    mockContextValue.displayEnvironments = envs;

    renderWithRouter(<PipelineCanvas />);

    expect(capturedDetailPanelProps?.hasAnyDeployedEnv).toBe(false);
  });

  it('passes a refresh callback that calls handleRefreshEnvironment', () => {
    const envs = [makeEnv({ name: 'staging' })];
    mockContextValue.environments = envs;
    mockContextValue.displayEnvironments = envs;

    renderWithRouter(<PipelineCanvas />);

    capturedFlowCanvasProps?.onRefreshEnv('staging');
    expect(mockHandleRefreshEnvironment).toHaveBeenCalledWith('staging');
  });

  // Suspend / redeploy are now exclusive to the RHS detail panel; the
  // canvas no longer exposes onSuspend / onRedeploy. Coverage moved to
  // EnvironmentDetailPanel.test.tsx.

  it('navigates to overrides with a pending promote action when onPromote is invoked', async () => {
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

    renderWithRouter(<PipelineCanvas />);

    await capturedFlowCanvasProps?.onPromote(envs[0], 'staging');

    expect(mockNavigateToOverrides).toHaveBeenCalledWith('staging', {
      type: 'promote',
      releaseName: 'release-1',
      sourceEnvironment: 'dev-res',
      targetEnvironment: 'staging',
    });
  });

  it('wires onRolloutRestart on the detail panel through to handleRolloutRestart', async () => {
    const envs = [
      makeEnv({
        name: 'production',
        bindingName: 'prod-binding',
        deployment: { status: 'Ready' },
      }),
    ];
    mockContextValue.environments = envs;
    mockContextValue.displayEnvironments = envs;

    renderWithRouter(<PipelineCanvas />);

    act(() => {
      capturedFlowCanvasProps?.onSelectEnv('production');
    });
    // re-render captures fresh detail-panel props once selection mounts
    await capturedDetailPanelProps?.onRolloutRestart?.();
    expect(mockHandleRolloutRestart).toHaveBeenCalledWith('prod-binding');
  });

  it('routes onOpenOverrides through navigateToOverrides', () => {
    const envs = [makeEnv({ name: 'production' })];
    mockContextValue.environments = envs;
    mockContextValue.displayEnvironments = envs;

    renderWithRouter(<PipelineCanvas />);

    capturedFlowCanvasProps?.onOpenOverrides(envs[0]);
    expect(mockNavigateToOverrides).toHaveBeenCalledWith('production');
  });
});
