import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EnvironmentActions } from './EnvironmentActions';
import type { EnvironmentActionsProps, ItemActionTracker } from '../types';

// ---- Mocks ----

const mockUseDeployPermission = jest.fn();
const mockUseUndeployPermission = jest.fn();
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useDeployPermission: () => mockUseDeployPermission(),
  useUndeployPermission: () => mockUseUndeployPermission(),
}));

// ---- Helpers ----

function createTracker(overrides: Partial<ItemActionTracker> = {}): ItemActionTracker {
  return {
    isActive: jest.fn().mockReturnValue(false),
    withTracking: jest.fn((_item: string, fn: () => Promise<any>) => fn()),
    activeItems: new Set<string>(),
    startAction: jest.fn(),
    endAction: jest.fn(),
    ...overrides,
  } as unknown as ItemActionTracker;
}

function renderActions(overrides: Partial<EnvironmentActionsProps> = {}) {
  const defaultProps: EnvironmentActionsProps = {
    environmentName: 'development',
    deploymentStatus: 'Ready',
    onPromote: jest.fn(),
    onSuspend: jest.fn(),
    onRedeploy: jest.fn(),
    isAlreadyPromoted: jest.fn().mockReturnValue(false),
    promotionTracker: createTracker(),
    suspendTracker: createTracker(),
    ...overrides,
  };

  return { ...render(<EnvironmentActions {...defaultProps} />), props: defaultProps };
}

const grantedDeploy = {
  canDeploy: true,
  loading: false,
  deniedTooltip: '',
};

const deniedDeploy = {
  canDeploy: false,
  loading: false,
  deniedTooltip: 'You do not have permission to deploy',
};

const grantedUndeploy = {
  canUndeploy: true,
  loading: false,
  deniedTooltip: '',
};

const deniedUndeploy = {
  canUndeploy: false,
  loading: false,
  deniedTooltip: 'You do not have permission to undeploy',
};

// ---- Tests ----

describe('EnvironmentActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDeployPermission.mockReturnValue(grantedDeploy);
    mockUseUndeployPermission.mockReturnValue(grantedUndeploy);
  });

  it('renders nothing when no promotion targets and no binding', () => {
    const { container } = renderActions({
      promotionTargets: undefined,
      bindingName: undefined,
    });

    expect(container.firstChild).toBeNull();
  });

  it('renders promote button for single target with permission', () => {
    renderActions({
      promotionTargets: [{ name: 'staging' }],
    });

    const btn = screen.getByRole('button', { name: /promote/i });
    expect(btn).toBeEnabled();
    expect(btn).toHaveTextContent('Promote');
  });

  it('calls onPromote with correct target on click', async () => {
    const user = userEvent.setup();
    const onPromote = jest.fn();

    renderActions({
      promotionTargets: [{ name: 'staging', resourceName: 'staging-res' }],
      onPromote,
    });

    await user.click(screen.getByRole('button', { name: /promote/i }));
    expect(onPromote).toHaveBeenCalledWith('staging-res');
  });

  it('shows "Promoted" and disables button when already promoted', () => {
    renderActions({
      promotionTargets: [{ name: 'staging' }],
      isAlreadyPromoted: jest.fn().mockReturnValue(true),
    });

    const btn = screen.getByRole('button', { name: /promoted/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent('Promoted');
  });

  it('shows "Promoting..." when promotion is in progress', () => {
    renderActions({
      promotionTargets: [{ name: 'staging' }],
      promotionTracker: createTracker({
        isActive: jest.fn().mockReturnValue(true),
      }),
    });

    const btn = screen.getByRole('button', { name: /promoting/i });
    expect(btn).toBeDisabled();
  });

  it('disables promote button when user lacks deploy permission', () => {
    mockUseDeployPermission.mockReturnValue(deniedDeploy);

    renderActions({
      promotionTargets: [{ name: 'staging' }],
    });

    expect(screen.getByRole('button', { name: /promote/i })).toBeDisabled();
  });

  it('shows Undeploy button when has binding and not undeployed', () => {
    renderActions({
      bindingName: 'my-binding',
      statusReason: undefined,
    });

    const btn = screen.getByRole('button', { name: /undeploy/i });
    expect(btn).toBeEnabled();
  });

  it('calls onSuspend when Undeploy is clicked', async () => {
    const user = userEvent.setup();
    const onSuspend = jest.fn();

    renderActions({
      bindingName: 'my-binding',
      onSuspend,
    });

    await user.click(screen.getByRole('button', { name: /undeploy/i }));
    expect(onSuspend).toHaveBeenCalled();
  });

  it('shows Redeploy button when resources are undeployed', () => {
    renderActions({
      bindingName: 'my-binding',
      statusReason: 'ResourcesUndeployed',
    });

    const btn = screen.getByRole('button', { name: /redeploy/i });
    expect(btn).toBeEnabled();
  });

  it('calls onRedeploy when Redeploy is clicked', async () => {
    const user = userEvent.setup();
    const onRedeploy = jest.fn();

    renderActions({
      bindingName: 'my-binding',
      statusReason: 'ResourcesUndeployed',
      onRedeploy,
    });

    await user.click(screen.getByRole('button', { name: /redeploy/i }));
    expect(onRedeploy).toHaveBeenCalled();
  });

  it('disables undeploy/redeploy when user lacks permission', () => {
    mockUseUndeployPermission.mockReturnValue(deniedUndeploy);

    renderActions({
      bindingName: 'my-binding',
    });

    expect(screen.getByRole('button', { name: /undeploy/i })).toBeDisabled();
  });

  it('renders stacked buttons for multiple promotion targets', () => {
    renderActions({
      promotionTargets: [
        { name: 'staging', resourceName: 'staging-res' },
        { name: 'production', resourceName: 'production-res' },
      ],
    });

    expect(screen.getByRole('button', { name: /promote to staging/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /promote to production/i })).toBeInTheDocument();
  });

  it('calls onPromote with correct target for multi-target', async () => {
    const user = userEvent.setup();
    const onPromote = jest.fn();

    renderActions({
      promotionTargets: [
        { name: 'staging', resourceName: 'staging-res' },
        { name: 'production', resourceName: 'prod-res' },
      ],
      onPromote,
    });

    await user.click(screen.getByRole('button', { name: /promote to production/i }));
    expect(onPromote).toHaveBeenCalledWith('prod-res');
  });

  it('shows approval required text for target requiring approval', () => {
    renderActions({
      promotionTargets: [
        { name: 'production', requiresApproval: true },
      ],
    });

    expect(screen.getByRole('button')).toHaveTextContent('Promote (Approval Required)');
  });
});
