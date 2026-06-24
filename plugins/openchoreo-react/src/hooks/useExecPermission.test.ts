import { renderHook } from '@testing-library/react';
import { useExecPermission } from './useExecPermission';

jest.mock('./useEnvScopedPermission');
jest.mock('@backstage/plugin-catalog-react');
jest.mock('@backstage/catalog-model', () => ({
  stringifyEntityRef: () => 'component:default/test',
}));

const { useEnvScopedPermission: mockUseEnvScopedPermission } = jest.requireMock(
  './useEnvScopedPermission',
);
const { useEntity: mockUseEntity } = jest.requireMock(
  '@backstage/plugin-catalog-react',
);

const componentEntity = {
  entity: {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: { name: 'test', namespace: 'default' },
  },
};

describe('useExecPermission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseEntity.mockReturnValue(componentEntity);
  });

  it('returns canExec=true when allowed', () => {
    mockUseEnvScopedPermission.mockReturnValue({
      allowed: true,
      loading: false,
    });
    const { result } = renderHook(() => useExecPermission());

    expect(result.current.canExec).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(result.current.deniedTooltip).toBe('');
    expect(result.current.permissionName).toBeTruthy();
  });

  it('returns loading=true and empty tooltip while permission is loading', () => {
    mockUseEnvScopedPermission.mockReturnValue({
      allowed: false,
      loading: true,
    });
    const { result } = renderHook(() => useExecPermission());

    expect(result.current.loading).toBe(true);
    expect(result.current.deniedTooltip).toBe('');
  });

  it('returns generic denied tooltip when denied with no environment', () => {
    mockUseEnvScopedPermission.mockReturnValue({
      allowed: false,
      loading: false,
    });
    const { result } = renderHook(() => useExecPermission());

    expect(result.current.canExec).toBe(false);
    expect(result.current.deniedTooltip).toBe(
      'You do not have permission to exec into this component.',
    );
  });

  it('returns environment-specific denied tooltip when denied with environment arg', () => {
    mockUseEnvScopedPermission.mockReturnValue({
      allowed: false,
      loading: false,
    });
    const { result } = renderHook(() => useExecPermission('production'));

    expect(result.current.deniedTooltip).toBe(
      'You do not have permission to exec into this component in production.',
    );
  });

  it('passes resourceRef and environment to useEnvScopedPermission', () => {
    mockUseEnvScopedPermission.mockReturnValue({
      allowed: true,
      loading: false,
    });
    renderHook(() => useExecPermission('staging'));

    expect(mockUseEnvScopedPermission).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceRef: 'component:default/test',
        environment: 'staging',
      }),
    );
  });

  it('returns permissionName matching openchoreo.exec', () => {
    mockUseEnvScopedPermission.mockReturnValue({
      allowed: true,
      loading: false,
    });
    const { result } = renderHook(() => useExecPermission());

    expect(result.current.permissionName).toBe('openchoreo.exec');
  });
});
