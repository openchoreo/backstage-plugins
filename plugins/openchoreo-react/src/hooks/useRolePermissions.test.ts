import { renderHook } from '@testing-library/react';
import { useRolePermissions } from './useRolePermissions';

const mockUsePermission = jest.fn();
jest.mock('@backstage/plugin-permission-react', () => ({
  usePermission: (...args: any[]) => mockUsePermission(...args),
}));

describe('useRolePermissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns all permissions allowed', () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    const { result } = renderHook(() => useRolePermissions());

    expect(result.current.canView).toBe(true);
    expect(result.current.canCreate).toBe(true);
    expect(result.current.canUpdate).toBe(true);
    expect(result.current.canDelete).toBe(true);
    expect(result.current.viewDeniedTooltip).toBe('');
    expect(result.current.createDeniedTooltip).toBe('');
    expect(result.current.updateDeniedTooltip).toBe('');
    expect(result.current.deleteDeniedTooltip).toBe('');
  });

  it('returns loading state for all permissions', () => {
    mockUsePermission.mockReturnValue({ allowed: false, loading: true });
    const { result } = renderHook(() => useRolePermissions());

    expect(result.current.loading).toBe(true);
    expect(result.current.viewDeniedTooltip).toBe('');
    expect(result.current.createDeniedTooltip).toBe('');
    expect(result.current.updateDeniedTooltip).toBe('');
    expect(result.current.deleteDeniedTooltip).toBe('');
  });

  it('returns denied tooltips when not allowed', () => {
    mockUsePermission.mockReturnValue({ allowed: false, loading: false });
    const { result } = renderHook(() => useRolePermissions());

    expect(result.current.canView).toBe(false);
    expect(result.current.canCreate).toBe(false);
    expect(result.current.canUpdate).toBe(false);
    expect(result.current.canDelete).toBe(false);
    expect(result.current.viewDeniedTooltip).toBeTruthy();
    expect(result.current.createDeniedTooltip).toBeTruthy();
    expect(result.current.updateDeniedTooltip).toBeTruthy();
    expect(result.current.deleteDeniedTooltip).toBeTruthy();
  });

  it('calls usePermission four times without resourceRef', () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    renderHook(() => useRolePermissions());

    expect(mockUsePermission.mock.calls.length).toBeGreaterThanOrEqual(4);
    for (const call of mockUsePermission.mock.calls) {
      expect(call[0]).not.toHaveProperty('resourceRef');
    }
  });
});
