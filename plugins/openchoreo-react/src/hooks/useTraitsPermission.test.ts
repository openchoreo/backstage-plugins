import { renderHook } from '@testing-library/react';
import { useTraitsPermission } from './useTraitsPermission';

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

describe('useTraitsPermission', () => {
  it('returns canViewTraits=true when allowed', () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    const { result } = renderHook(() => useTraitsPermission());

    expect(result.current.canViewTraits).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(result.current.deniedTooltip).toBe('');
    expect(result.current.permissionName).toBeTruthy();
  });

  it('returns loading=true during permission check', () => {
    mockUsePermission.mockReturnValue({ allowed: false, loading: true });
    const { result } = renderHook(() => useTraitsPermission());

    expect(result.current.loading).toBe(true);
    expect(result.current.deniedTooltip).toBe('');
  });

  it('returns denied tooltip when not allowed', () => {
    mockUsePermission.mockReturnValue({ allowed: false, loading: false });
    const { result } = renderHook(() => useTraitsPermission());

    expect(result.current.canViewTraits).toBe(false);
    expect(result.current.deniedTooltip).toBeTruthy();
  });

  it('passes entity resource ref to usePermission', () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    renderHook(() => useTraitsPermission());

    expect(mockUsePermission).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceRef: 'component:default/test',
      }),
    );
  });
});
