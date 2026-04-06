import { renderHook } from '@testing-library/react';
import { useComponentUpdatePermission } from './useComponentUpdatePermission';

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

describe('useComponentUpdatePermission', () => {
  it('returns canUpdateComponent=true when allowed', () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    const { result } = renderHook(() => useComponentUpdatePermission());

    expect(result.current.canUpdateComponent).toBe(true);
    expect(result.current.loading).toBe(false);
  });

  it('returns loading=true during permission check', () => {
    mockUsePermission.mockReturnValue({ allowed: false, loading: true });
    const { result } = renderHook(() => useComponentUpdatePermission());

    expect(result.current.loading).toBe(true);
  });

  it('returns canUpdateComponent=false when not allowed', () => {
    mockUsePermission.mockReturnValue({ allowed: false, loading: false });
    const { result } = renderHook(() => useComponentUpdatePermission());

    expect(result.current.canUpdateComponent).toBe(false);
  });

  it('passes entity resource ref to usePermission', () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    renderHook(() => useComponentUpdatePermission());

    expect(mockUsePermission).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceRef: 'component:default/test',
      }),
    );
  });
});
