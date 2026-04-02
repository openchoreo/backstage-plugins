import { renderHook } from '@testing-library/react';
import { useBuildPermission } from './useBuildPermission';

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

describe('useBuildPermission (Variant C: entity-scoped, multiple permissions)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns both permissions allowed', () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    const { result } = renderHook(() => useBuildPermission());

    expect(result.current.canBuild).toBe(true);
    expect(result.current.canView).toBe(true);
    expect(result.current.triggerBuildDeniedTooltip).toBe('');
    expect(result.current.viewBuildDeniedTooltip).toBe('');
  });

  it('returns loading state for both permissions', () => {
    mockUsePermission.mockReturnValue({ allowed: false, loading: true });
    const { result } = renderHook(() => useBuildPermission());

    expect(result.current.triggerLoading).toBe(true);
    expect(result.current.viewLoading).toBe(true);
    expect(result.current.triggerBuildDeniedTooltip).toBe('');
    expect(result.current.viewBuildDeniedTooltip).toBe('');
  });

  it('returns denied tooltips when not allowed', () => {
    mockUsePermission.mockReturnValue({ allowed: false, loading: false });
    const { result } = renderHook(() => useBuildPermission());

    expect(result.current.canBuild).toBe(false);
    expect(result.current.canView).toBe(false);
    expect(result.current.triggerBuildDeniedTooltip).toBeTruthy();
    expect(result.current.viewBuildDeniedTooltip).toBeTruthy();
  });

  it('calls usePermission twice with entity resource ref', () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    renderHook(() => useBuildPermission());

    // Called at least 2 times (once per permission, may be more with StrictMode)
    expect(mockUsePermission.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(mockUsePermission).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceRef: 'component:default/test',
      }),
    );
  });
});
