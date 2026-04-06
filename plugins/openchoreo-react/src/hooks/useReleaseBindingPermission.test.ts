import { renderHook } from '@testing-library/react';
import { useReleaseBindingPermission } from './useReleaseBindingPermission';

const mockUsePermission = jest.fn();
jest.mock('@backstage/plugin-permission-react', () => ({
  usePermission: (...args: any[]) => mockUsePermission(...args),
}));

describe('useReleaseBindingPermission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns canViewBindings=true when allowed', () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    const { result } = renderHook(() => useReleaseBindingPermission());

    expect(result.current.canViewBindings).toBe(true);
    expect(result.current.loading).toBe(false);
  });

  it('returns loading=true during permission check', () => {
    mockUsePermission.mockReturnValue({ allowed: false, loading: true });
    const { result } = renderHook(() => useReleaseBindingPermission());

    expect(result.current.loading).toBe(true);
  });

  it('returns canViewBindings=false when not allowed', () => {
    mockUsePermission.mockReturnValue({ allowed: false, loading: false });
    const { result } = renderHook(() => useReleaseBindingPermission());

    expect(result.current.canViewBindings).toBe(false);
  });

  it('does not pass resourceRef to usePermission', () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    renderHook(() => useReleaseBindingPermission());

    expect(mockUsePermission).toHaveBeenCalledWith(
      expect.not.objectContaining({ resourceRef: expect.anything() }),
    );
  });
});
