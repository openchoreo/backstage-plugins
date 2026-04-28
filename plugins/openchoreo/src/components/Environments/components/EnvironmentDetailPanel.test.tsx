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

  it('fires onRefresh and onOpenOverrides via the panel chrome', async () => {
    const user = userEvent.setup();
    const { props } = renderPanel({
      environment: makeEnv({ name: 'staging' }),
    });
    await user.click(screen.getByLabelText('Refresh environment'));
    await user.click(screen.getByLabelText('Configure overrides'));
    expect(props.onRefresh).toHaveBeenCalled();
    expect(props.onOpenOverrides).toHaveBeenCalled();
  });
});
