import { renderHook } from '@testing-library/react';
import { useClusterHookCreatePermission } from './useClusterHookCreatePermission';

const mockUsePermission = jest.fn();
jest.mock('@backstage/plugin-permission-react', () => ({
  usePermission: (...args: any[]) => mockUsePermission(...args),
}));

// The create button on the catalog list is disabled from this hook's result;
// a wrong tooltip or a stale loading flag would either hide the button from
// authorised users or show it to unauthorised ones.
describe('useClusterHookCreatePermission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns canCreate=true when allowed', () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    const { result } = renderHook(() => useClusterHookCreatePermission());

    expect(result.current.canCreate).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(result.current.createDeniedTooltip).toBe('');
  });

  it('returns loading=true during permission check', () => {
    mockUsePermission.mockReturnValue({ allowed: false, loading: true });
    const { result } = renderHook(() => useClusterHookCreatePermission());

    expect(result.current.loading).toBe(true);
    expect(result.current.createDeniedTooltip).toBe('');
  });

  it('returns denied tooltip when not allowed', () => {
    mockUsePermission.mockReturnValue({ allowed: false, loading: false });
    const { result } = renderHook(() => useClusterHookCreatePermission());

    expect(result.current.canCreate).toBe(false);
    expect(result.current.createDeniedTooltip).toContain('cluster hook');
  });

  it('does not pass resourceRef to usePermission', () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    renderHook(() => useClusterHookCreatePermission());

    expect(mockUsePermission).toHaveBeenCalledWith(
      expect.not.objectContaining({ resourceRef: expect.anything() }),
    );
  });
});
