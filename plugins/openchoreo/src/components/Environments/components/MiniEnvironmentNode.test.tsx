import { render, screen, within } from '@testing-library/react';
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

jest.mock('@openchoreo/backstage-design-system', () => ({
  StatusBadge: (props: { status: string }) => (
    <span data-testid="status-badge">{props.status}</span>
  ),
}));

// ReleaseManifestDialog uses useApi/useEntity which need provider context
// these tests don't supply. The dialog has its own focused test file.
jest.mock('./ReleaseManifestDialog', () => ({
  ReleaseManifestDialog: () => null,
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

  it('shows simple Promote button when env has a single target', async () => {
    const user = userEvent.setup();
    const onPromote = jest.fn();
    const onSelect = jest.fn();
    renderNode({
      environment: makeEnv({
        name: 'staging',
        bindingName: 'staging-binding',
        deployment: { status: 'Ready' },
        promotionTargets: [{ name: 'prod', resourceName: 'prod-res' }],
      }),
      onPromote,
      onSelect,
    });
    const promoteBtn = screen.getByRole('button', { name: /^promote$/i });
    expect(promoteBtn).toBeEnabled();
    await user.click(promoteBtn);
    expect(onPromote).toHaveBeenCalledWith('prod-res');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('does NOT show Undeploy or Redeploy on the canvas tile', () => {
    renderNode({
      environment: makeEnv({
        name: 'staging',
        bindingName: 'staging-binding',
        deployment: { status: 'Ready' },
        promotionTargets: [{ name: 'prod', resourceName: 'prod-res' }],
      }),
    });
    expect(screen.queryByRole('button', { name: /undeploy/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /redeploy/i })).toBeNull();
  });

  it('renders no Promote button when env has no binding (never deployed)', () => {
    renderNode({
      environment: makeEnv({
        name: 'staging',
        deployment: { status: 'Ready' },
        promotionTargets: [{ name: 'prod', resourceName: 'prod-res' }],
      }),
    });
    expect(screen.queryByRole('button', { name: /promote/i })).toBeNull();
  });

  it('renders no Promote button when env has no targets', () => {
    renderNode({
      environment: makeEnv({
        name: 'staging',
        bindingName: 'staging-binding',
        deployment: { status: 'Ready' },
      }),
    });
    expect(screen.queryByRole('button', { name: /promote/i })).toBeNull();
  });

  it('renders no Promote button when env status is not Ready', () => {
    renderNode({
      environment: makeEnv({
        name: 'staging',
        bindingName: 'staging-binding',
        deployment: { status: 'Failed' as any },
        promotionTargets: [{ name: 'prod', resourceName: 'prod-res' }],
      }),
    });
    expect(screen.queryByRole('button', { name: /promote/i })).toBeNull();
  });

  it('renders disabled "Promoted" pill when all targets are already promoted', () => {
    renderNode({
      environment: makeEnv({
        name: 'staging',
        bindingName: 'staging-binding',
        deployment: { status: 'Ready' },
        promotionTargets: [
          { name: 'prod', resourceName: 'prod-res' },
          { name: 'canary', resourceName: 'canary-res' },
        ],
      }),
      isAlreadyPromoted: () => true,
    });
    const promoted = screen.getByRole('button', { name: /^promoted$/i });
    expect(promoted).toBeDisabled();
  });

  it('renders Promote menu trigger when env has multiple targets', async () => {
    const user = userEvent.setup();
    renderNode({
      environment: makeEnv({
        name: 'staging',
        bindingName: 'staging-binding',
        deployment: { status: 'Ready' },
        promotionTargets: [
          { name: 'prod', resourceName: 'prod-res' },
          { name: 'canary', resourceName: 'canary-res' },
        ],
      }),
    });
    const trigger = screen.getByRole('button', { name: /^promote$/i });
    expect(trigger).toBeEnabled();
    await user.click(trigger);
    expect(
      screen.getByRole('menuitem', { name: /promote to…/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: /promote to all/i }),
    ).toBeInTheDocument();
  });

  it('opens nested submenu on "Promote to…" with one item per target', async () => {
    const user = userEvent.setup();
    renderNode({
      environment: makeEnv({
        name: 'staging',
        bindingName: 'staging-binding',
        deployment: { status: 'Ready' },
        promotionTargets: [
          { name: 'prod', resourceName: 'prod-res' },
          { name: 'canary', resourceName: 'canary-res' },
        ],
      }),
    });
    await user.click(screen.getByRole('button', { name: /^promote$/i }));
    await user.click(screen.getByRole('menuitem', { name: /promote to…/i }));
    expect(
      screen.getByRole('menuitem', { name: /^prod$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: /^canary$/i }),
    ).toBeInTheDocument();
  });

  it('clicking a per-target submenu item fires onPromote with that target', async () => {
    const user = userEvent.setup();
    const onPromote = jest.fn();
    renderNode({
      environment: makeEnv({
        name: 'staging',
        bindingName: 'staging-binding',
        deployment: { status: 'Ready' },
        promotionTargets: [
          { name: 'prod', resourceName: 'prod-res' },
          { name: 'canary', resourceName: 'canary-res' },
        ],
      }),
      onPromote,
    });
    await user.click(screen.getByRole('button', { name: /^promote$/i }));
    await user.click(screen.getByRole('menuitem', { name: /promote to…/i }));
    await user.click(screen.getByRole('menuitem', { name: /^canary$/i }));
    expect(onPromote).toHaveBeenCalledWith('canary-res');
  });

  it('disables an already-promoted target in the submenu', async () => {
    const user = userEvent.setup();
    renderNode({
      environment: makeEnv({
        name: 'staging',
        bindingName: 'staging-binding',
        deployment: { status: 'Ready' },
        promotionTargets: [
          { name: 'prod', resourceName: 'prod-res' },
          { name: 'canary', resourceName: 'canary-res' },
        ],
      }),
      isAlreadyPromoted: target => target === 'canary',
    });
    await user.click(screen.getByRole('button', { name: /^promote$/i }));
    await user.click(screen.getByRole('menuitem', { name: /promote to…/i }));
    const canaryItem = screen.getByRole('menuitem', {
      name: /canary \(promoted\)/i,
    });
    expect(canaryItem).toHaveAttribute('aria-disabled', 'true');
  });

  it('renders "Promote to all" disabled in this PR (bulk promote not wired yet)', async () => {
    const user = userEvent.setup();
    renderNode({
      environment: makeEnv({
        name: 'staging',
        bindingName: 'staging-binding',
        deployment: { status: 'Ready' },
        promotionTargets: [
          { name: 'prod', resourceName: 'prod-res' },
          { name: 'canary', resourceName: 'canary-res' },
        ],
      }),
    });
    await user.click(screen.getByRole('button', { name: /^promote$/i }));
    const promoteAll = screen.getByRole('menuitem', {
      name: /promote to all/i,
    });
    expect(promoteAll).toHaveAttribute('aria-disabled', 'true');
  });

  it('selects the tile and opens the menu when the … overflow button is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();
    renderNode({ onSelect });
    await user.click(screen.getByLabelText('Actions for staging'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });

  it('marks the card as selected via class name when selected', () => {
    renderNode({ selected: true });
    const card = screen.getByLabelText('Select environment staging');
    expect(card.className).toMatch(/cardSelected/);
  });

  it('does not list Undeploy in the overflow menu', async () => {
    const user = userEvent.setup();
    renderNode({
      environment: makeEnv({
        name: 'staging',
        bindingName: 'staging-binding',
        deployment: { status: 'Ready' },
      }),
    });
    await user.click(screen.getByLabelText('Actions for staging'));
    // The overflow menu sits in a portal; scope the assertion to the
    // visible menu items rather than the whole document.
    const menu = screen.getByRole('menu');
    expect(
      within(menu).queryByRole('menuitem', { name: /undeploy/i }),
    ).toBeNull();
  });

  it('renders the drift badge when driftInfo.isBehind is true', () => {
    renderNode({
      environment: makeEnv({
        name: 'staging',
        bindingName: 'staging-binding',
        deployment: { status: 'Ready', releaseName: 'rel-5' },
      }),
      driftInfo: {
        isBehind: true,
        aheadUpstreams: [{ envName: 'dev', releaseName: 'rel-7' }],
      },
    });
    expect(screen.getByLabelText('behind upstream')).toBeInTheDocument();
  });

  it('omits the drift badge when not behind', () => {
    renderNode({
      environment: makeEnv({
        name: 'staging',
        bindingName: 'staging-binding',
        deployment: { status: 'Ready' },
      }),
    });
    expect(screen.queryByLabelText('behind upstream')).toBeNull();
  });

  it('lists "View release manifest" in the overflow menu when releaseName exists', async () => {
    const user = userEvent.setup();
    renderNode({
      environment: makeEnv({
        name: 'staging',
        bindingName: 'staging-binding',
        deployment: { status: 'Ready', releaseName: 'rel-7' },
      }),
    });
    await user.click(screen.getByLabelText('Actions for staging'));
    const menu = screen.getByRole('menu');
    expect(
      within(menu).getByRole('menuitem', { name: /view release manifest/i }),
    ).toBeInTheDocument();
  });

  it('renders release-gated overflow items disabled (not hidden) when no releaseName', async () => {
    const user = userEvent.setup();
    renderNode({
      environment: makeEnv({
        name: 'staging',
        bindingName: 'staging-binding',
        deployment: { status: 'Ready' },
      }),
    });
    await user.click(screen.getByLabelText('Actions for staging'));
    const menu = screen.getByRole('menu');
    // Items still render — they're just disabled.
    const manifestItem = within(menu).getByRole('menuitem', {
      name: /view release manifest/i,
    });
    const artifactsItem = within(menu).getByRole('menuitem', {
      name: /view k8s artifacts/i,
    });
    expect(manifestItem).toHaveAttribute('aria-disabled', 'true');
    expect(artifactsItem).toHaveAttribute('aria-disabled', 'true');
  });

  it('renders Configure overrides disabled (not hidden) when no bindingName', async () => {
    const user = userEvent.setup();
    renderNode({
      environment: makeEnv({
        name: 'staging',
        bindingName: undefined,
        deployment: { status: 'Ready' },
      }),
    });
    await user.click(screen.getByLabelText('Actions for staging'));
    const menu = screen.getByRole('menu');
    const overridesItem = within(menu).getByRole('menuitem', {
      name: /configure overrides/i,
    });
    expect(overridesItem).toHaveAttribute('aria-disabled', 'true');
  });

  it('groups overflow menu items with a divider', async () => {
    const user = userEvent.setup();
    renderNode({
      environment: makeEnv({
        name: 'staging',
        bindingName: 'staging-binding',
        deployment: { status: 'Ready', releaseName: 'rel-7' },
      }),
    });
    await user.click(screen.getByLabelText('Actions for staging'));
    const menu = screen.getByRole('menu');
    expect(within(menu).getAllByRole('separator').length).toBeGreaterThan(0);
  });

  it('shows the cloud kind icon next to the env name', () => {
    renderNode({
      environment: makeEnv({ name: 'staging' }),
    });
    // The icon is decorative (aria-hidden); the env name is the
    // accessible label. Just confirm an SVG sits next to the name.
    const card = screen.getByLabelText('Select environment staging');
    expect(card.querySelectorAll('svg').length).toBeGreaterThan(0);
  });

  it('renders a StatusBadge with the env status variant', () => {
    renderNode({
      environment: makeEnv({
        name: 'staging',
        deployment: { status: 'Ready' },
      }),
    });
    expect(screen.getByTestId('status-badge')).toHaveTextContent('active');
  });

  it('shows the active-incidents chip when activeIncidentCount > 0', () => {
    renderNode({
      environment: makeEnv({ name: 'staging' }),
      activeIncidentCount: 3,
    });
    const chip = screen.getByLabelText('active incidents');
    expect(chip).toHaveTextContent('3');
  });

  it('omits the active-incidents chip when activeIncidentCount is 0 or undefined', () => {
    const { rerender } = renderNode({
      environment: makeEnv({ name: 'staging' }),
      activeIncidentCount: 0,
    });
    expect(screen.queryByLabelText('active incidents')).toBeNull();

    rerender(
      <MiniEnvironmentNode
        environment={makeEnv({ name: 'staging' })}
        selected={false}
        isRefreshing={false}
        isAlreadyPromoted={() => false}
        actionTrackers={{
          promotionTracker: tracker(),
          suspendTracker: tracker(),
        }}
        onSelect={jest.fn()}
        onRefresh={jest.fn()}
        onOpenOverrides={jest.fn()}
        onOpenReleaseDetails={jest.fn()}
        onPromote={jest.fn()}
      />,
    );
    expect(screen.queryByLabelText('active incidents')).toBeNull();
  });
});
