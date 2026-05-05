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

jest.mock('./SetupDetailPane', () => ({
  SetupDetailPane: (props: { onClose: () => void }) => (
    <div data-testid="setup-detail-pane">
      <button type="button" onClick={props.onClose}>
        close-setup
      </button>
    </div>
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
    selection: null,
    isAlreadyPromoted: () => false,
    actionTrackers: { promotionTracker: tracker(), suspendTracker: tracker() },
    hasAnyDeployedEnv: false,
    isWorkloadEditorSupported: true,
    environmentsExist: true,
    loadingSetup: false,
    onConfigureWorkload: jest.fn(),
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
  it('shows the "get started" empty state when nothing is deployed yet', () => {
    renderPanel({ selection: null, hasAnyDeployedEnv: false });
    expect(
      screen.getByText(/configure & deploy your component to get started/i),
    ).toBeInTheDocument();
  });

  it('shows the "select env or update setup" empty state when something is deployed', () => {
    renderPanel({ selection: null, hasAnyDeployedEnv: true });
    expect(
      screen.getByText(/select an environment to view details/i),
    ).toBeInTheDocument();
  });

  it('renders SetupDetailPane when selection is setup', () => {
    renderPanel({ selection: { kind: 'setup' } });
    expect(screen.getByTestId('setup-detail-pane')).toBeInTheDocument();
  });

  it('renders the env name and status badge for an env selection', () => {
    renderPanel({
      selection: {
        kind: 'env',
        environment: makeEnv({
          name: 'production',
          deployment: { status: 'Ready' },
        }),
      },
    });
    expect(screen.getByText('production')).toBeInTheDocument();
    const badges = screen.getAllByTestId('status-badge');
    expect(badges[0]).toHaveTextContent('active');
  });

  it('fires onClose when the close button on the env panel is clicked', async () => {
    const user = userEvent.setup();
    const { props } = renderPanel({
      selection: { kind: 'env', environment: makeEnv({ name: 'staging' }) },
    });
    await user.click(screen.getByLabelText('Close detail panel'));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('fires onRefresh from the env panel chrome', async () => {
    const user = userEvent.setup();
    const { props } = renderPanel({
      selection: { kind: 'env', environment: makeEnv({ name: 'staging' }) },
    });
    await user.click(screen.getByLabelText('Refresh environment'));
    expect(props.onRefresh).toHaveBeenCalled();
  });

  it('fires onOpenOverrides from the prominent Configure overrides button', async () => {
    const user = userEvent.setup();
    const { props } = renderPanel({
      selection: {
        kind: 'env',
        environment: makeEnv({
          name: 'staging',
          bindingName: 'staging-binding',
        }),
      },
    });
    await user.click(
      screen.getByRole('button', { name: /configure overrides/i }),
    );
    expect(props.onOpenOverrides).toHaveBeenCalled();
  });

  it('disables Configure overrides when the env has no binding (not deployed)', () => {
    renderPanel({
      selection: {
        kind: 'env',
        environment: makeEnv({
          name: 'staging',
          // no bindingName ⇒ never deployed
        }),
      },
    });
    expect(
      screen.getByRole('button', { name: /configure overrides/i }),
    ).toBeDisabled();
  });

  it('shows the Remove deployment button when binding exists and onRemoveDeployment is provided', () => {
    renderPanel({
      selection: {
        kind: 'env',
        environment: makeEnv({
          name: 'staging',
          bindingName: 'staging-binding',
        }),
      },
      onRemoveDeployment: jest.fn().mockResolvedValue(undefined),
    });
    expect(
      screen.getByRole('button', { name: /remove deployment/i }),
    ).toBeEnabled();
  });

  it('hides Remove deployment when the env has no binding', () => {
    renderPanel({
      selection: {
        kind: 'env',
        environment: makeEnv({ name: 'staging' }),
      },
      onRemoveDeployment: jest.fn().mockResolvedValue(undefined),
    });
    expect(
      screen.queryByRole('button', { name: /remove deployment/i }),
    ).toBeNull();
  });

  it('opens a confirmation dialog before firing onRemoveDeployment', async () => {
    const user = userEvent.setup();
    const onRemoveDeployment = jest.fn().mockResolvedValue(undefined);
    renderPanel({
      selection: {
        kind: 'env',
        environment: makeEnv({
          name: 'staging',
          bindingName: 'staging-binding',
        }),
      },
      onRemoveDeployment,
    });
    await user.click(
      screen.getByRole('button', { name: /^remove deployment$/i }),
    );
    // Dialog opens, callback NOT yet fired
    expect(onRemoveDeployment).not.toHaveBeenCalled();
    expect(
      screen.getByText(/remove deployment from staging\?/i),
    ).toBeInTheDocument();

    // Confirm via the dialog's primary button
    await user.click(
      screen.getByRole('button', { name: /^remove deployment$/i }),
    );
    expect(onRemoveDeployment).toHaveBeenCalled();
  });

  it('shows the Rollout restart button when the env has an active deployment', () => {
    renderPanel({
      selection: {
        kind: 'env',
        environment: makeEnv({
          name: 'staging',
          bindingName: 'staging-binding',
          deployment: { status: 'Ready' },
        }),
      },
      onRolloutRestart: jest.fn().mockResolvedValue(undefined),
    });
    expect(
      screen.getByRole('button', { name: /rollout restart/i }),
    ).toBeEnabled();
  });

  it('hides Rollout restart when the env is undeployed', () => {
    renderPanel({
      selection: {
        kind: 'env',
        environment: makeEnv({
          name: 'staging',
          bindingName: 'staging-binding',
          deployment: { status: 'Ready', statusReason: 'ResourcesUndeployed' },
        }),
      },
      onRolloutRestart: jest.fn().mockResolvedValue(undefined),
    });
    expect(
      screen.queryByRole('button', { name: /rollout restart/i }),
    ).toBeNull();
  });

  it('hides Rollout restart when no bindingName exists', () => {
    renderPanel({
      selection: {
        kind: 'env',
        environment: makeEnv({
          name: 'staging',
          deployment: { status: 'Ready' },
        }),
      },
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
      selection: {
        kind: 'env',
        environment: makeEnv({
          name: 'staging',
          bindingName: 'staging-binding',
          deployment: { status: 'Ready' },
        }),
      },
      onRolloutRestart,
    });
    await user.click(screen.getByRole('button', { name: /rollout restart/i }));
    expect(onRolloutRestart).toHaveBeenCalled();
  });

  it('does not render the cogwheel IconButton in the header anymore', () => {
    renderPanel({
      selection: { kind: 'env', environment: makeEnv({ name: 'staging' }) },
    });
    expect(screen.queryByLabelText('Configure overrides')).toBeNull();
  });

  it('renders the Promote footer when env has Ready status, binding, and at least one target', () => {
    renderPanel({
      selection: {
        kind: 'env',
        environment: makeEnv({
          name: 'staging',
          bindingName: 'staging-binding',
          deployment: { status: 'Ready' },
          promotionTargets: [{ name: 'prod', resourceName: 'prod-res' }],
        }),
      },
    });
    expect(
      screen.getByRole('button', { name: /^promote$/i }),
    ).toBeInTheDocument();
  });

  it('hides the Promote footer when env has no binding', () => {
    renderPanel({
      selection: {
        kind: 'env',
        environment: makeEnv({
          name: 'staging',
          deployment: { status: 'Ready' },
          promotionTargets: [{ name: 'prod', resourceName: 'prod-res' }],
        }),
      },
    });
    expect(screen.queryByRole('button', { name: /^promote$/i })).toBeNull();
  });

  it('hides the Promote footer when env has no targets', () => {
    renderPanel({
      selection: {
        kind: 'env',
        environment: makeEnv({
          name: 'staging',
          bindingName: 'staging-binding',
          deployment: { status: 'Ready' },
        }),
      },
    });
    expect(screen.queryByRole('button', { name: /^promote$/i })).toBeNull();
  });
});
