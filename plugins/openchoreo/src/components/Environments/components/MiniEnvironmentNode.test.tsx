import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  MiniEnvironmentNode,
  type MiniEnvironmentNodeProps,
} from './MiniEnvironmentNode';
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
    resourceName: overrides.resourceName,
  };
}

function renderNode(overrides: Partial<MiniEnvironmentNodeProps> = {}) {
  const props: MiniEnvironmentNodeProps = {
    environment: makeEnv({ name: 'staging' }),
    selected: false,
    isRefreshing: false,
    isAlreadyPromoted: () => false,
    actionTrackers: { promotionTracker: tracker(), suspendTracker: tracker() },
    onSelect: jest.fn(),
    onRefresh: jest.fn(),
    onOpenOverrides: jest.fn(),
    onOpenReleaseDetails: jest.fn(),
    onPromote: jest.fn(),
    onSuspend: jest.fn(),
    onRedeploy: jest.fn(),
    ...overrides,
  };
  return { ...render(<MiniEnvironmentNode {...props} />), props };
}

describe('MiniEnvironmentNode', () => {
  it('renders environment name and version label', () => {
    renderNode({
      environment: makeEnv({
        name: 'staging',
        deployment: { status: 'Ready', image: 'app:v3.0.9' },
      }),
    });
    expect(screen.getByText('staging')).toBeInTheDocument();
    expect(screen.getByText('v3.0.9')).toBeInTheDocument();
  });

  it('fires onSelect when clicking the node body', async () => {
    const user = userEvent.setup();
    const { props } = renderNode();
    await user.click(screen.getByLabelText('Select environment staging'));
    expect(props.onSelect).toHaveBeenCalled();
  });

  it('does not fire onSelect when clicking the primary promote button', async () => {
    const user = userEvent.setup();
    const onPromote = jest.fn();
    const onSelect = jest.fn();
    renderNode({
      environment: makeEnv({
        name: 'staging',
        deployment: { status: 'Ready' },
        promotionTargets: [{ name: 'prod', resourceName: 'prod-res' }],
      }),
      onPromote,
      onSelect,
    });
    await user.click(screen.getByRole('button', { name: /promote/i }));
    expect(onPromote).toHaveBeenCalledWith('prod-res');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('does not fire onSelect when opening the overflow menu', async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();
    renderNode({ onSelect });
    await user.click(screen.getByLabelText('Actions for staging'));
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });

  it('marks the card as selected via class name when selected', () => {
    renderNode({ selected: true });
    const card = screen.getByLabelText('Select environment staging');
    expect(card.className).toMatch(/cardSelected/);
  });

  it('shows a Redeploy primary action when env is undeployed', () => {
    renderNode({
      environment: makeEnv({
        name: 'staging',
        bindingName: 'b1',
        deployment: { status: 'Ready', statusReason: 'ResourcesUndeployed' },
      }),
    });
    expect(screen.getByRole('button', { name: /redeploy/i })).toBeEnabled();
  });

  it('shows both Promote and Undeploy when env is Ready with binding + targets', async () => {
    const user = userEvent.setup();
    const onPromote = jest.fn();
    const onSuspend = jest.fn();
    renderNode({
      environment: makeEnv({
        name: 'staging',
        bindingName: 'staging-binding',
        deployment: { status: 'Ready' },
        promotionTargets: [{ name: 'prod', resourceName: 'prod-res' }],
      }),
      onPromote,
      onSuspend,
    });
    const promoteBtn = screen.getByRole('button', { name: /promote/i });
    const undeployBtn = screen.getByRole('button', { name: /^undeploy$/i });
    expect(promoteBtn).toBeEnabled();
    expect(undeployBtn).toBeEnabled();

    await user.click(undeployBtn);
    expect(onSuspend).toHaveBeenCalled();
    expect(onPromote).not.toHaveBeenCalled();
  });

  it('does not list Undeploy in the overflow menu (it lives on the action row now)', async () => {
    const user = userEvent.setup();
    renderNode({
      environment: makeEnv({
        name: 'staging',
        bindingName: 'staging-binding',
        deployment: { status: 'Ready' },
      }),
    });
    await user.click(screen.getByLabelText('Actions for staging'));
    expect(screen.queryByRole('menuitem', { name: /undeploy/i })).toBeNull();
  });
});
