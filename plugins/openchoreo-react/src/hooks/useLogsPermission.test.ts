import { renderHook } from '@testing-library/react';
import { useLogsPermission } from './useLogsPermission';

const mockUsePermission = jest.fn();
jest.mock('@backstage/plugin-permission-react', () => ({
  usePermission: (...args: any[]) => mockUsePermission(...args),
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

describe('useLogsPermission', () => {
  beforeEach(() => {
    mockUseEntity.mockReturnValue(componentEntity);
  });

  it('returns canViewLogs=true when allowed', () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    const { result } = renderHook(() => useLogsPermission());

    expect(result.current.canViewLogs).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(result.current.deniedTooltip).toBe('');
    expect(result.current.permissionName).toBeTruthy();
  });

  it('returns loading=true during permission check', () => {
    mockUsePermission.mockReturnValue({ allowed: false, loading: true });
    const { result } = renderHook(() => useLogsPermission());

    expect(result.current.loading).toBe(true);
    expect(result.current.deniedTooltip).toBe('');
  });

  it('returns denied tooltip for component when not allowed', () => {
    mockUsePermission.mockReturnValue({ allowed: false, loading: false });
    const { result } = renderHook(() => useLogsPermission());

    expect(result.current.canViewLogs).toBe(false);
    expect(result.current.deniedTooltip).toContain('component');
  });

  it('returns denied tooltip for project when entity kind is System', () => {
    mockUseEntity.mockReturnValue(systemEntity);
    mockUsePermission.mockReturnValue({ allowed: false, loading: false });
    const { result } = renderHook(() => useLogsPermission());

    expect(result.current.deniedTooltip).toContain('project');
  });

  it('passes entity resource ref to usePermission', () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    renderHook(() => useLogsPermission());

    expect(mockUsePermission).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceRef: 'component:default/test',
      }),
    );
  });
});
