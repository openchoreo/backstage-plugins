import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  PromotePrimaryAction,
  type PromotePrimaryActionProps,
} from './PromotePrimaryAction';
import type { ItemActionTracker } from '../types';

const mockUseDeployPermission = jest.fn();
const mockUseUndeployPermission = jest.fn();
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useDeployPermission: () => mockUseDeployPermission(),
  useUndeployPermission: () => mockUseUndeployPermission(),
}));

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

function renderPromote(overrides: Partial<PromotePrimaryActionProps> = {}) {
  const props: PromotePrimaryActionProps = {
    environmentName: 'dev',
    bindingName: 'dev-binding',
    deploymentStatus: 'Ready',
    promotionTargets: [{ name: 'staging', resourceName: 'staging-res' }],
    isAlreadyPromoted: () => false,
    promotionTracker: createTracker(),
    onPromote: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return { ...render(<PromotePrimaryAction {...props} />), props };
}

describe('PromotePrimaryAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDeployPermission.mockReturnValue({
      canDeploy: true,
      loading: false,
      deniedTooltip: '',
    });
    mockUseUndeployPermission.mockReturnValue({
      canUndeploy: true,
      loading: false,
      deniedTooltip: '',
    });
  });

  it('renders nothing when env has no binding', () => {
    const { container } = renderPromote({ bindingName: undefined });
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when env status is not Ready', () => {
    const { container } = renderPromote({
      deploymentStatus: 'Failed' as any,
    });
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when env has no promotion targets', () => {
    const { container } = renderPromote({ promotionTargets: undefined });
    expect(container.firstChild).toBeNull();
  });

  it('renders simple Promote button for a single target', () => {
    renderPromote();
    const btn = screen.getByRole('button', { name: /^promote$/i });
    expect(btn).toBeEnabled();
  });

  it('fires onPromote with target resourceName when single-target button is clicked', async () => {
    const user = userEvent.setup();
    const onPromote = jest.fn().mockResolvedValue(undefined);
    renderPromote({
      promotionTargets: [{ name: 'staging', resourceName: 'staging-res' }],
      onPromote,
    });
    await user.click(screen.getByRole('button', { name: /^promote$/i }));
    expect(onPromote).toHaveBeenCalledWith('staging-res');
  });

  it('renders disabled "Promoted" pill when all targets are already promoted', () => {
    renderPromote({
      promotionTargets: [
        { name: 'staging', resourceName: 'staging-res' },
        { name: 'prod', resourceName: 'prod-res' },
      ],
      isAlreadyPromoted: () => true,
    });
    const pill = screen.getByRole('button', { name: /^promoted$/i });
    expect(pill).toBeDisabled();
  });

  it('renders Promote ▾ trigger for multi-target and opens menu on click', async () => {
    const user = userEvent.setup();
    renderPromote({
      promotionTargets: [
        { name: 'staging', resourceName: 'staging-res' },
        { name: 'prod', resourceName: 'prod-res' },
      ],
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

  it('renders nested submenu with one item per target', async () => {
    const user = userEvent.setup();
    renderPromote({
      promotionTargets: [
        { name: 'staging', resourceName: 'staging-res' },
        { name: 'prod', resourceName: 'prod-res' },
      ],
    });
    await user.click(screen.getByRole('button', { name: /^promote$/i }));
    await user.click(screen.getByRole('menuitem', { name: /promote to…/i }));
    expect(
      screen.getByRole('menuitem', { name: /^staging$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: /^prod$/i }),
    ).toBeInTheDocument();
  });

  it('clicking a per-target submenu item fires onPromote with that target', async () => {
    const user = userEvent.setup();
    const onPromote = jest.fn().mockResolvedValue(undefined);
    renderPromote({
      promotionTargets: [
        { name: 'staging', resourceName: 'staging-res' },
        { name: 'prod', resourceName: 'prod-res' },
      ],
      onPromote,
    });
    await user.click(screen.getByRole('button', { name: /^promote$/i }));
    await user.click(screen.getByRole('menuitem', { name: /promote to…/i }));
    await user.click(screen.getByRole('menuitem', { name: /^prod$/i }));
    expect(onPromote).toHaveBeenCalledWith('prod-res');
  });

  it('disables an already-promoted target in the submenu', async () => {
    const user = userEvent.setup();
    renderPromote({
      promotionTargets: [
        { name: 'staging', resourceName: 'staging-res' },
        { name: 'prod', resourceName: 'prod-res' },
      ],
      isAlreadyPromoted: target => target === 'prod',
    });
    await user.click(screen.getByRole('button', { name: /^promote$/i }));
    await user.click(screen.getByRole('menuitem', { name: /promote to…/i }));
    const promotedItem = screen.getByRole('menuitem', {
      name: /prod \(promoted\)/i,
    });
    expect(promotedItem).toHaveAttribute('aria-disabled', 'true');
  });

  it('renders "Promote to all" disabled in this PR', async () => {
    const user = userEvent.setup();
    renderPromote({
      promotionTargets: [
        { name: 'staging', resourceName: 'staging-res' },
        { name: 'prod', resourceName: 'prod-res' },
      ],
    });
    await user.click(screen.getByRole('button', { name: /^promote$/i }));
    const promoteAll = screen.getByRole('menuitem', {
      name: /promote to all/i,
    });
    expect(promoteAll).toHaveAttribute('aria-disabled', 'true');
  });
});
