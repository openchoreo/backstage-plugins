import { renderHook } from '@testing-library/react';
import { useEnvironmentReadPermission } from './useEnvironmentReadPermission';

const mockUsePermission = jest.fn();
jest.mock('@backstage/plugin-permission-react', () => ({
  usePermission: (...args: any[]) => mockUsePermission(...args),
}));

describe('useEnvironmentReadPermission', () => {
  it('returns canViewEnvironments=true when allowed', () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    const { result } = renderHook(() => useEnvironmentReadPermission());

    expect(result.current.canViewEnvironments).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(result.current.deniedTooltip).toBe('');
    expect(result.current.permissionName).toBeTruthy();
  });

  it('returns loading=true during permission check', () => {
    mockUsePermission.mockReturnValue({ allowed: false, loading: true });
    const { result } = renderHook(() => useEnvironmentReadPermission());

    expect(result.current.loading).toBe(true);
    expect(result.current.deniedTooltip).toBe('');
  });

  it('returns denied tooltip when not allowed', () => {
    mockUsePermission.mockReturnValue({ allowed: false, loading: false });
    const { result } = renderHook(() => useEnvironmentReadPermission());

    expect(result.current.canViewEnvironments).toBe(false);
    expect(result.current.deniedTooltip).toBeTruthy();
  });

  it('does not pass resourceRef to usePermission', () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    renderHook(() => useEnvironmentReadPermission());

    expect(mockUsePermission).toHaveBeenCalledWith(
      expect.not.objectContaining({ resourceRef: expect.anything() }),
    );
  });
});
