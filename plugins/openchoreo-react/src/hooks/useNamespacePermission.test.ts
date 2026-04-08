import { renderHook } from '@testing-library/react';
import { useNamespacePermission } from './useNamespacePermission';

const mockUsePermission = jest.fn();
jest.mock('@backstage/plugin-permission-react', () => ({
  usePermission: (...args: any[]) => mockUsePermission(...args),
}));

describe('useNamespacePermission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns both permissions allowed', () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    const { result } = renderHook(() => useNamespacePermission());

    expect(result.current.canView).toBe(true);
    expect(result.current.canCreate).toBe(true);
    expect(result.current.viewDeniedTooltip).toBe('');
    expect(result.current.createDeniedTooltip).toBe('');
  });

  it('returns loading state', () => {
    mockUsePermission.mockReturnValue({ allowed: false, loading: true });
    const { result } = renderHook(() => useNamespacePermission());

    expect(result.current.loading).toBe(true);
    expect(result.current.viewDeniedTooltip).toBe('');
    expect(result.current.createDeniedTooltip).toBe('');
  });

  it('returns denied tooltips when not allowed', () => {
    mockUsePermission.mockReturnValue({ allowed: false, loading: false });
    const { result } = renderHook(() => useNamespacePermission());

    expect(result.current.canView).toBe(false);
    expect(result.current.canCreate).toBe(false);
    expect(result.current.viewDeniedTooltip).toBeTruthy();
    expect(result.current.createDeniedTooltip).toBeTruthy();
  });

  it('calls usePermission twice without resourceRef', () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    renderHook(() => useNamespacePermission());

    expect(mockUsePermission.mock.calls.length).toBeGreaterThanOrEqual(2);
    for (const call of mockUsePermission.mock.calls) {
      expect(call[0]).not.toHaveProperty('resourceRef');
    }
  });
});
