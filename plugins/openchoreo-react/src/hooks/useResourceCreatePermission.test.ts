import { renderHook } from '@testing-library/react';
import { useResourceCreatePermission } from './useResourceCreatePermission';

const mockUsePermission = jest.fn();
jest.mock('@backstage/plugin-permission-react', () => ({
  usePermission: (...args: any[]) => mockUsePermission(...args),
}));

describe('useResourceCreatePermission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns canCreate=true when allowed', () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    const { result } = renderHook(() => useResourceCreatePermission());

    expect(result.current.canCreate).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(result.current.createDeniedTooltip).toBe('');
  });

  it('returns loading=true during permission check', () => {
    mockUsePermission.mockReturnValue({ allowed: false, loading: true });
    const { result } = renderHook(() => useResourceCreatePermission());

    expect(result.current.loading).toBe(true);
    expect(result.current.createDeniedTooltip).toBe('');
  });

  it('returns denied tooltip when not allowed', () => {
    mockUsePermission.mockReturnValue({ allowed: false, loading: false });
    const { result } = renderHook(() => useResourceCreatePermission());

    expect(result.current.canCreate).toBe(false);
    expect(result.current.createDeniedTooltip).toBeTruthy();
  });

  it('does not pass resourceRef to usePermission', () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    renderHook(() => useResourceCreatePermission());

    expect(mockUsePermission).toHaveBeenCalledWith(
      expect.not.objectContaining({ resourceRef: expect.anything() }),
    );
  });
});
