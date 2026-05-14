import { renderHook } from '@testing-library/react';
import { usePromotionAction } from './usePromotionAction';
import type { ItemActionTracker } from '../types';

const mockUseDeployPermission = jest.fn();
const mockUseUndeployPermission = jest.fn();

jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useDeployPermission: () => mockUseDeployPermission(),
  useUndeployPermission: () => mockUseUndeployPermission(),
}));

function tracker(active = false): ItemActionTracker {
  return {
    isActive: jest.fn().mockReturnValue(active),
    withTracking: jest.fn(async (_id: string, fn: () => Promise<any>) => fn()),
    activeItems: new Set<string>(),
    startAction: jest.fn(),
    endAction: jest.fn(),
  } as unknown as ItemActionTracker;
}

describe('usePromotionAction', () => {
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

  it('returns no actions when env is not Ready', () => {
    const { result } = renderHook(() =>
      usePromotionAction({
        environmentName: 'dev',
        deploymentStatus: 'NotReady',
        promotionTargets: [{ name: 'staging' }],
        isAlreadyPromoted: () => false,
        promotionTracker: tracker(),
        suspendTracker: tracker(),
        onPromote: jest.fn(),
        onSuspend: jest.fn(),
        onRedeploy: jest.fn(),
      }),
    );
    expect(result.current.promotionActions).toHaveLength(0);
    expect(result.current.primaryPromotion).toBeNull();
  });

  it('returns enabled per-target promotion actions when Ready', () => {
    const { result } = renderHook(() =>
      usePromotionAction({
        environmentName: 'dev',
        deploymentStatus: 'Ready',
        promotionTargets: [{ name: 'staging' }, { name: 'prod' }],
        isAlreadyPromoted: () => false,
        promotionTracker: tracker(),
        suspendTracker: tracker(),
        onPromote: jest.fn(),
        onSuspend: jest.fn(),
        onRedeploy: jest.fn(),
      }),
    );
    expect(result.current.promotionActions).toHaveLength(2);
    expect(result.current.promotionActions[0].label).toBe('Promote to staging');
    expect(result.current.promotionActions[1].label).toBe('Promote to prod');
    expect(result.current.primaryPromotion?.target.name).toBe('staging');
  });

  it('marks already-promoted targets as disabled and prefers a non-promoted primary', () => {
    const { result } = renderHook(() =>
      usePromotionAction({
        environmentName: 'dev',
        deploymentStatus: 'Ready',
        promotionTargets: [{ name: 'staging' }, { name: 'prod' }],
        isAlreadyPromoted: name => name === 'staging',
        promotionTracker: tracker(),
        suspendTracker: tracker(),
        onPromote: jest.fn(),
        onSuspend: jest.fn(),
        onRedeploy: jest.fn(),
      }),
    );
    expect(result.current.promotionActions[0].disabled).toBe(true);
    expect(result.current.promotionActions[0].label).toBe(
      'Promoted to staging',
    );
    expect(result.current.primaryPromotion?.target.name).toBe('prod');
  });

  it('flags an in-flight promotion via the tracker', () => {
    const promo = tracker();
    (promo.isActive as jest.Mock).mockImplementation(
      (name: string) => name === 'staging',
    );
    const { result } = renderHook(() =>
      usePromotionAction({
        environmentName: 'dev',
        deploymentStatus: 'Ready',
        promotionTargets: [{ name: 'staging' }],
        isAlreadyPromoted: () => false,
        promotionTracker: promo,
        suspendTracker: tracker(),
        onPromote: jest.fn(),
        onSuspend: jest.fn(),
        onRedeploy: jest.fn(),
      }),
    );
    expect(result.current.promotionActions[0].isPromoting).toBe(true);
    expect(result.current.promotionActions[0].label).toBe('Promoting...');
    expect(result.current.primaryPromotion).toBeNull();
  });

  it('blocks promotion when the user lacks deploy permission', () => {
    mockUseDeployPermission.mockReturnValue({
      canDeploy: false,
      loading: false,
      deniedTooltip: 'denied',
    });
    const { result } = renderHook(() =>
      usePromotionAction({
        environmentName: 'dev',
        deploymentStatus: 'Ready',
        promotionTargets: [{ name: 'staging' }],
        isAlreadyPromoted: () => false,
        promotionTracker: tracker(),
        suspendTracker: tracker(),
        onPromote: jest.fn(),
        onSuspend: jest.fn(),
        onRedeploy: jest.fn(),
      }),
    );
    expect(result.current.promotionActions[0].disabled).toBe(true);
    expect(result.current.allPromotionsDisabled).toBe(true);
  });

  it('emits an undeploy action when binding exists and status is not undeployed', () => {
    const { result } = renderHook(() =>
      usePromotionAction({
        environmentName: 'dev',
        bindingName: 'b1',
        deploymentStatus: 'Ready',
        statusReason: undefined,
        isAlreadyPromoted: () => false,
        promotionTracker: tracker(),
        suspendTracker: tracker(),
        onPromote: jest.fn(),
        onSuspend: jest.fn(),
        onRedeploy: jest.fn(),
      }),
    );
    expect(result.current.undeployAction?.kind).toBe('undeploy');
    expect(result.current.undeployAction?.label).toBe('Undeploy');
  });

  it('emits a redeploy action when status is undeployed', () => {
    const { result } = renderHook(() =>
      usePromotionAction({
        environmentName: 'dev',
        bindingName: 'b1',
        deploymentStatus: 'Ready',
        statusReason: 'ResourcesUndeployed',
        isAlreadyPromoted: () => false,
        promotionTracker: tracker(),
        suspendTracker: tracker(),
        onPromote: jest.fn(),
        onSuspend: jest.fn(),
        onRedeploy: jest.fn(),
      }),
    );
    expect(result.current.undeployAction?.kind).toBe('redeploy');
  });
});
