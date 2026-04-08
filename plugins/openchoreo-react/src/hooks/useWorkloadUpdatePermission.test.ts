import { renderHook } from '@testing-library/react';
import { useWorkloadUpdatePermission } from './useWorkloadUpdatePermission';

const mockUsePermission = jest.fn();
jest.mock('@backstage/plugin-permission-react', () => ({
  usePermission: (...args: any[]) => mockUsePermission(...args),
}));

jest.mock('@backstage/plugin-catalog-react', () => ({
  useEntity: () => ({
    entity: {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: { name: 'test', namespace: 'default' },
    },
  }),
}));

jest.mock('@backstage/catalog-model', () => ({
  stringifyEntityRef: () => 'component:default/test',
}));

describe('useWorkloadUpdatePermission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns canUpdateWorkload=true when allowed', () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    const { result } = renderHook(() => useWorkloadUpdatePermission());

    expect(result.current.canUpdateWorkload).toBe(true);
    expect(result.current.loading).toBe(false);
  });

  it('returns loading=true during permission check', () => {
    mockUsePermission.mockReturnValue({ allowed: false, loading: true });
    const { result } = renderHook(() => useWorkloadUpdatePermission());

    expect(result.current.loading).toBe(true);
  });

  it('returns canUpdateWorkload=false when not allowed', () => {
    mockUsePermission.mockReturnValue({ allowed: false, loading: false });
    const { result } = renderHook(() => useWorkloadUpdatePermission());

    expect(result.current.canUpdateWorkload).toBe(false);
  });

  it('passes entity resource ref to usePermission', () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    renderHook(() => useWorkloadUpdatePermission());

    expect(mockUsePermission).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceRef: 'component:default/test',
      }),
    );
  });
});
