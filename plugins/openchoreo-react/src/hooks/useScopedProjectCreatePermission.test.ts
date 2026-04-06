import { renderHook } from '@testing-library/react';
import { useScopedProjectCreatePermission } from './useScopedProjectCreatePermission';

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

describe('useScopedProjectCreatePermission', () => {
  it('returns canCreate=true when allowed', () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    const { result } = renderHook(() => useScopedProjectCreatePermission());

    expect(result.current.canCreate).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(result.current.createDeniedTooltip).toBe('');
  });

  it('returns loading=true during permission check', () => {
    mockUsePermission.mockReturnValue({ allowed: false, loading: true });
    const { result } = renderHook(() => useScopedProjectCreatePermission());

    expect(result.current.loading).toBe(true);
    expect(result.current.createDeniedTooltip).toBe('');
  });

  it('returns denied tooltip when not allowed', () => {
    mockUsePermission.mockReturnValue({ allowed: false, loading: false });
    const { result } = renderHook(() => useScopedProjectCreatePermission());

    expect(result.current.canCreate).toBe(false);
    expect(result.current.createDeniedTooltip).toBeTruthy();
  });

  it('passes entity resource ref to usePermission', () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    renderHook(() => useScopedProjectCreatePermission());

    expect(mockUsePermission).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceRef: 'component:default/test',
      }),
    );
  });
});
