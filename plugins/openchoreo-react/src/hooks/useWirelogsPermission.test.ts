import { renderHook } from '@testing-library/react';
import { useWirelogsPermission } from './useWirelogsPermission';

const mockUseEnvScopedPermission = jest.fn();
jest.mock('./useEnvScopedPermission', () => ({
  useEnvScopedPermission: (...args: any[]) =>
    mockUseEnvScopedPermission(...args),
}));

const mockEntity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'api', namespace: 'default' },
};
const mockUseEntity = jest.fn(() => ({ entity: mockEntity }));
jest.mock('@backstage/plugin-catalog-react', () => ({
  useEntity: () => mockUseEntity(),
}));

jest.mock('@backstage/catalog-model', () => ({
  stringifyEntityRef: (e: any) =>
    `${e.kind}:${e.metadata.namespace}/${e.metadata.name}`.toLowerCase(),
}));

describe('useWirelogsPermission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseEntity.mockReturnValue({ entity: mockEntity });
  });

  it('returns canViewWirelogs=true with no tooltip when allowed', () => {
    mockUseEnvScopedPermission.mockReturnValue({
      allowed: true,
      loading: false,
    });
    const { result } = renderHook(() => useWirelogsPermission('dev'));

    expect(result.current.canViewWirelogs).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(result.current.deniedTooltip).toBe('');
    expect(result.current.permissionName).toBeTruthy();
  });

  it('keeps deniedTooltip empty while the permission is loading', () => {
    mockUseEnvScopedPermission.mockReturnValue({
      allowed: false,
      loading: true,
    });
    const { result } = renderHook(() => useWirelogsPermission());

    expect(result.current.loading).toBe(true);
    expect(result.current.deniedTooltip).toBe('');
  });

  it('returns an env-specific tooltip when denied with an environment supplied', () => {
    mockUseEnvScopedPermission.mockReturnValue({
      allowed: false,
      loading: false,
    });
    const { result } = renderHook(() => useWirelogsPermission('dev'));

    expect(result.current.canViewWirelogs).toBe(false);
    expect(result.current.deniedTooltip).toBe(
      'You do not have permission to view wirelogs in dev.',
    );
  });

  it('returns a component-scoped tooltip when denied without an environment', () => {
    mockUseEnvScopedPermission.mockReturnValue({
      allowed: false,
      loading: false,
    });
    const { result } = renderHook(() => useWirelogsPermission());

    expect(result.current.deniedTooltip).toBe(
      'You do not have permission to view wirelogs of this component.',
    );
  });

  it('uses "project" in the tooltip for System entities', () => {
    mockUseEntity.mockReturnValueOnce({
      entity: {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'System',
        metadata: { name: 'proj', namespace: 'default' },
      },
    });
    mockUseEnvScopedPermission.mockReturnValue({
      allowed: false,
      loading: false,
    });

    const { result } = renderHook(() => useWirelogsPermission());

    expect(result.current.deniedTooltip).toBe(
      'You do not have permission to view wirelogs of this project.',
    );
  });

  it('forwards the entity ref and environment into useEnvScopedPermission', () => {
    mockUseEnvScopedPermission.mockReturnValue({
      allowed: true,
      loading: false,
    });
    renderHook(() => useWirelogsPermission('prod'));

    expect(mockUseEnvScopedPermission).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceRef: 'component:default/api',
        environment: 'prod',
      }),
    );
  });
});
