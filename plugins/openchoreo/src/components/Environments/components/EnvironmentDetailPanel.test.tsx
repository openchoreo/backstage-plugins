import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  EnvironmentDetailPanel,
  type EnvironmentDetailPanelProps,
} from './EnvironmentDetailPanel';
import type { Environment, ItemActionTracker } from '../types';

jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useDeployPermission: () => ({
    canDeploy: true,
    loading: false,
    deniedTooltip: '',
  }),
  useUndeployPermission: () => ({
    canUndeploy: true,
    loading: false,
    deniedTooltip: '',
  }),
  formatRelativeTime: (s: string) => `relative-${s}`,
}));

jest.mock('@openchoreo/backstage-design-system', () => ({
  StatusBadge: (props: { status: string }) => (
    <span data-testid="status-badge">{props.status}</span>
  ),
}));

function tracker(): ItemActionTracker {
  return {
    isActive: () => false,
    withTracking: async (_id: string, fn: () => Promise<any>) => fn(),
    activeItems: new Set<string>(),
    startAction: jest.fn(),
    endAction: jest.fn(),
  } as unknown as ItemActionTracker;
}

function makeEnv(
  overrides: Partial<Environment> & { name: string },
): Environment {
  return {
    name: overrides.name,
    deployment: overrides.deployment ?? { status: 'Ready' },
    endpoints: overrides.endpoints ?? [],
    promotionTargets: overrides.promotionTargets,
    bindingName: overrides.bindingName,
  };
}

function renderPanel(overrides: Partial<EnvironmentDetailPanelProps> = {}) {
  const props: EnvironmentDetailPanelProps = {
    environment: null,
    isAlreadyPromoted: () => false,
    actionTrackers: { promotionTracker: tracker(), suspendTracker: tracker() },
    onClose: jest.fn(),
    onRefresh: jest.fn(),
    onOpenOverrides: jest.fn(),
    onOpenReleaseDetails: jest.fn(),
    onPromote: jest.fn().mockResolvedValue(undefined),
    onSuspend: jest.fn().mockResolvedValue(undefined),
    onRedeploy: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return { ...render(<EnvironmentDetailPanel {...props} />), props };
}

describe('EnvironmentDetailPanel', () => {
  it('shows the empty state when no environment is selected', () => {
    renderPanel();
    expect(
      screen.getByText('Click an environment on the graph to see its details.'),
    ).toBeInTheDocument();
  });

  it('renders the env name and status badge for a selected env', () => {
    renderPanel({
      environment: makeEnv({
        name: 'production',
        deployment: { status: 'Ready' },
      }),
    });
    expect(screen.getByText('production')).toBeInTheDocument();
    // Both the panel header pill and the card content body render a badge.
    const badges = screen.getAllByTestId('status-badge');
    expect(badges[0]).toHaveTextContent('active');
  });

  it('fires onClose when the close button is clicked', async () => {
    const user = userEvent.setup();
    const { props } = renderPanel({
      environment: makeEnv({ name: 'staging' }),
    });
    await user.click(screen.getByLabelText('Close detail panel'));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('fires onRefresh from the panel chrome', async () => {
    const user = userEvent.setup();
    const { props } = renderPanel({
      environment: makeEnv({ name: 'staging' }),
    });
    await user.click(screen.getByLabelText('Refresh environment'));
    expect(props.onRefresh).toHaveBeenCalled();
  });

  it('fires onOpenOverrides from the prominent Configure overrides button', async () => {
    const user = userEvent.setup();
    const { props } = renderPanel({
      environment: makeEnv({
        name: 'staging',
        bindingName: 'staging-binding',
      }),
    });
    await user.click(
      screen.getByRole('button', { name: /configure overrides/i }),
    );
    expect(props.onOpenOverrides).toHaveBeenCalled();
  });

  it('shows the Rollout restart button when the env has an active deployment', () => {
    renderPanel({
      environment: makeEnv({
        name: 'staging',
        bindingName: 'staging-binding',
        deployment: { status: 'Ready' },
      }),
      onRolloutRestart: jest.fn().mockResolvedValue(undefined),
    });
    expect(
      screen.getByRole('button', { name: /rollout restart/i }),
    ).toBeEnabled();
  });

  it('hides Rollout restart when the env is undeployed', () => {
    renderPanel({
      environment: makeEnv({
        name: 'staging',
        bindingName: 'staging-binding',
        deployment: { status: 'Ready', statusReason: 'ResourcesUndeployed' },
      }),
      onRolloutRestart: jest.fn().mockResolvedValue(undefined),
    });
    expect(
      screen.queryByRole('button', { name: /rollout restart/i }),
    ).toBeNull();
  });

  it('hides Rollout restart when no bindingName exists', () => {
    renderPanel({
      environment: makeEnv({
        name: 'staging',
        deployment: { status: 'Ready' },
      }),
      onRolloutRestart: jest.fn().mockResolvedValue(undefined),
    });
    expect(
      screen.queryByRole('button', { name: /rollout restart/i }),
    ).toBeNull();
  });

  it('fires onRolloutRestart when the button is clicked', async () => {
    const user = userEvent.setup();
    const onRolloutRestart = jest.fn().mockResolvedValue(undefined);
    renderPanel({
      environment: makeEnv({
        name: 'staging',
        bindingName: 'staging-binding',
        deployment: { status: 'Ready' },
      }),
      onRolloutRestart,
    });
    await user.click(
      screen.getByRole('button', { name: /rollout restart/i }),
    );
    expect(onRolloutRestart).toHaveBeenCalled();
  });

  it('does not render the cogwheel IconButton in the header anymore', () => {
    renderPanel({ environment: makeEnv({ name: 'staging' }) });
    expect(screen.queryByLabelText('Configure overrides')).toBeNull();
  });
});
