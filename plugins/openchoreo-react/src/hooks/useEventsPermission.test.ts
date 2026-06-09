import { renderHook } from '@testing-library/react';
import { useEventsPermission } from './useEventsPermission';

const mockUseEnvScopedPermission = jest.fn();
jest.mock('./useEnvScopedPermission', () => ({
  useEnvScopedPermission: (...args: any[]) =>
    mockUseEnvScopedPermission(...args),
}));

const mockUseEntity = jest.fn();
jest.mock('@backstage/plugin-catalog-react', () => ({
  useEntity: () => mockUseEntity(),
}));

jest.mock('@backstage/catalog-model', () => ({
  stringifyEntityRef: () => 'component:default/test',
}));

const componentEntity = {
  entity: {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: { name: 'test', namespace: 'default' },
  },
};

const systemEntity = {
  entity: {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'System',
    metadata: { name: 'test-project', namespace: 'default' },
  },
};

describe('useEventsPermission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseEntity.mockReturnValue(componentEntity);
  });

  it('returns canViewEvents=true when allowed', () => {
    mockUseEnvScopedPermission.mockReturnValue({
      allowed: true,
      loading: false,
    });
    const { result } = renderHook(() => useEventsPermission());

    expect(result.current.canViewEvents).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(result.current.deniedTooltip).toBe('');
    expect(result.current.permissionName).toBeTruthy();
  });

  it('returns loading=true during permission check', () => {
    mockUseEnvScopedPermission.mockReturnValue({
      allowed: false,
      loading: true,
    });
    const { result } = renderHook(() => useEventsPermission());

    expect(result.current.loading).toBe(true);
    expect(result.current.deniedTooltip).toBe('');
  });

  it('returns a component-scoped denied tooltip when not allowed', () => {
    mockUseEnvScopedPermission.mockReturnValue({
      allowed: false,
      loading: false,
    });
    const { result } = renderHook(() => useEventsPermission());

    expect(result.current.canViewEvents).toBe(false);
    expect(result.current.deniedTooltip).toContain('component');
  });

  it('returns a project-scoped denied tooltip for System entities', () => {
    mockUseEntity.mockReturnValue(systemEntity);
    mockUseEnvScopedPermission.mockReturnValue({
      allowed: false,
      loading: false,
    });
    const { result } = renderHook(() => useEventsPermission());

    expect(result.current.deniedTooltip).toContain('project');
  });

  it('returns an environment-scoped denied tooltip when an env is supplied', () => {
    mockUseEnvScopedPermission.mockReturnValue({
      allowed: false,
      loading: false,
    });
    const { result } = renderHook(() => useEventsPermission('production'));

    expect(result.current.deniedTooltip).toContain('production');
  });

  it('passes the entity resource ref and environment to useEnvScopedPermission', () => {
    mockUseEnvScopedPermission.mockReturnValue({
      allowed: true,
      loading: false,
    });
    renderHook(() => useEventsPermission('staging'));

    expect(mockUseEnvScopedPermission).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceRef: 'component:default/test',
        environment: 'staging',
      }),
    );
  });
});
