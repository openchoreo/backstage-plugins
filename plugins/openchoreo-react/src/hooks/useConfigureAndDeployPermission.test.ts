import { renderHook } from '@testing-library/react';
import { useConfigureAndDeployPermission } from './useConfigureAndDeployPermission';

const mockUseDeployPermission = jest.fn();
const mockUseComponentUpdatePermission = jest.fn();
const mockUseWorkloadUpdatePermission = jest.fn();

jest.mock('./useDeployPermission', () => ({
  useDeployPermission: () => mockUseDeployPermission(),
}));
jest.mock('./useComponentUpdatePermission', () => ({
  useComponentUpdatePermission: () => mockUseComponentUpdatePermission(),
}));
jest.mock('./useWorkloadUpdatePermission', () => ({
  useWorkloadUpdatePermission: () => mockUseWorkloadUpdatePermission(),
}));

describe('useConfigureAndDeployPermission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns canConfigureAndDeploy=true when all sub-hooks allow', () => {
    mockUseDeployPermission.mockReturnValue({
      canDeploy: true,
      loading: false,
    });
    mockUseComponentUpdatePermission.mockReturnValue({
      canUpdateComponent: true,
      loading: false,
    });
    mockUseWorkloadUpdatePermission.mockReturnValue({
      canUpdateWorkload: true,
      loading: false,
    });

    const { result } = renderHook(() => useConfigureAndDeployPermission());

    expect(result.current.canConfigureAndDeploy).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(result.current.deniedTooltip).toBe('');
  });

  it('returns canConfigureAndDeploy=true when only one sub-hook allows (OR logic)', () => {
    mockUseDeployPermission.mockReturnValue({
      canDeploy: true,
      loading: false,
    });
    mockUseComponentUpdatePermission.mockReturnValue({
      canUpdateComponent: false,
      loading: false,
    });
    mockUseWorkloadUpdatePermission.mockReturnValue({
      canUpdateWorkload: false,
      loading: false,
    });

    const { result } = renderHook(() => useConfigureAndDeployPermission());

    expect(result.current.canConfigureAndDeploy).toBe(true);
    expect(result.current.deniedTooltip).toBe('');
  });

  it('returns canConfigureAndDeploy=false when all sub-hooks deny', () => {
    mockUseDeployPermission.mockReturnValue({
      canDeploy: false,
      loading: false,
    });
    mockUseComponentUpdatePermission.mockReturnValue({
      canUpdateComponent: false,
      loading: false,
    });
    mockUseWorkloadUpdatePermission.mockReturnValue({
      canUpdateWorkload: false,
      loading: false,
    });

    const { result } = renderHook(() => useConfigureAndDeployPermission());

    expect(result.current.canConfigureAndDeploy).toBe(false);
    expect(result.current.deniedTooltip).toBeTruthy();
  });

  it('returns loading=true when any sub-hook is loading', () => {
    mockUseDeployPermission.mockReturnValue({
      canDeploy: false,
      loading: true,
    });
    mockUseComponentUpdatePermission.mockReturnValue({
      canUpdateComponent: false,
      loading: false,
    });
    mockUseWorkloadUpdatePermission.mockReturnValue({
      canUpdateWorkload: false,
      loading: false,
    });

    const { result } = renderHook(() => useConfigureAndDeployPermission());

    expect(result.current.loading).toBe(true);
    expect(result.current.deniedTooltip).toBe('');
  });
});
