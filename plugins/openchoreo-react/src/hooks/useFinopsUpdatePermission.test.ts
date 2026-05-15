import { renderHook } from '@testing-library/react';
import { useFinopsUpdatePermission } from './useFinopsUpdatePermission';

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

describe('useFinopsUpdatePermission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns canUpdateFinops=true when permission is allowed', () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    const { result } = renderHook(() => useFinopsUpdatePermission());

    expect(result.current.canUpdateFinops).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(result.current.deniedTooltip).toBe('');
    expect(result.current.permissionName).toBe('openchoreo.finops.update');
  });

  it('returns canUpdateFinops=false and a tooltip when denied', () => {
    mockUsePermission.mockReturnValue({ allowed: false, loading: false });
    const { result } = renderHook(() => useFinopsUpdatePermission());

    expect(result.current.canUpdateFinops).toBe(false);
    expect(result.current.deniedTooltip).toBeTruthy();
  });

  it('returns empty tooltip while loading even when not allowed', () => {
    mockUsePermission.mockReturnValue({ allowed: false, loading: true });
    const { result } = renderHook(() => useFinopsUpdatePermission());

    expect(result.current.loading).toBe(true);
    expect(result.current.deniedTooltip).toBe('');
  });

  it('passes the entity resource ref to usePermission', () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    renderHook(() => useFinopsUpdatePermission());

    expect(mockUsePermission).toHaveBeenCalledWith(
      expect.objectContaining({ resourceRef: 'component:default/test' }),
    );
  });

  it('passes the finops update permission to usePermission', () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    renderHook(() => useFinopsUpdatePermission());

    expect(mockUsePermission).toHaveBeenCalledWith(
      expect.objectContaining({
        permission: expect.objectContaining({
          name: 'openchoreo.finops.update',
        }),
      }),
    );
  });
});
