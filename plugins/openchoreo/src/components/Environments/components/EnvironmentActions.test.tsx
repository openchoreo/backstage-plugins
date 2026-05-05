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

function createTracker(
  overrides: Partial<ItemActionTracker> = {},
): ItemActionTracker {
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
    onSuspend: jest.fn(),
    onRedeploy: jest.fn(),
    suspendTracker: createTracker(),
    ...overrides,
  };

  return {
    ...render(<EnvironmentActions {...defaultProps} />),
    props: defaultProps,
  };
}

const grantedDeploy = {
  canDeploy: true,
  loading: false,
  deniedTooltip: '',
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

  it('renders nothing when there are no actions to show', () => {
    const { container } = renderActions({
      bindingName: undefined,
    });

    expect(container.firstChild).toBeNull();
  });

  it('does not render Promote — that lives in the panel footer now', () => {
    renderActions({
      bindingName: 'my-binding',
    });

    expect(screen.queryByRole('button', { name: /^promote/i })).toBeNull();
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
});
