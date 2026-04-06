import { renderHook } from '@testing-library/react';
import { useTraitCreatePermission } from './useTraitCreatePermission';

const mockUsePermission = jest.fn();
jest.mock('@backstage/plugin-permission-react', () => ({
  usePermission: (...args: any[]) => mockUsePermission(...args),
}));

describe('useTraitCreatePermission', () => {
  it('returns canCreate=true when allowed', () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    const { result } = renderHook(() => useTraitCreatePermission());

    expect(result.current.canCreate).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(result.current.createDeniedTooltip).toBe('');
  });

  it('returns loading=true during permission check', () => {
    mockUsePermission.mockReturnValue({ allowed: false, loading: true });
    const { result } = renderHook(() => useTraitCreatePermission());

    expect(result.current.loading).toBe(true);
    expect(result.current.createDeniedTooltip).toBe('');
  });

  it('returns denied tooltip when not allowed', () => {
    mockUsePermission.mockReturnValue({ allowed: false, loading: false });
    const { result } = renderHook(() => useTraitCreatePermission());

    expect(result.current.canCreate).toBe(false);
    expect(result.current.createDeniedTooltip).toBeTruthy();
  });

  it('does not pass resourceRef to usePermission', () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    renderHook(() => useTraitCreatePermission());

    expect(mockUsePermission).toHaveBeenCalledWith(
      expect.not.objectContaining({ resourceRef: expect.anything() }),
    );
  });
});
