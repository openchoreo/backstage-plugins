import { renderHook } from '@testing-library/react';
import { useResourceDefinitionPermission } from './useResourceDefinitionPermission';

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

const makeEntity = (kind: string) => ({
  entity: {
    apiVersion: 'backstage.io/v1alpha1',
    kind,
    metadata: { name: 'test', namespace: 'default' },
  },
});

describe('useResourceDefinitionPermission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseEntity.mockReturnValue(makeEntity('Component'));
  });

  it('returns allowed for resource-scoped kind with resourceRef', () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    const { result } = renderHook(() => useResourceDefinitionPermission());

    expect(result.current.canUpdate).toBe(true);
    expect(result.current.canDelete).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(result.current.updateDeniedTooltip).toBe('');
    expect(result.current.deleteDeniedTooltip).toBe('');

    // Verify resourceRef is passed for resource-scoped kind
    expect(mockUsePermission).toHaveBeenCalledWith(
      expect.objectContaining({ resourceRef: 'component:default/test' }),
    );
  });

  it('returns allowed for cluster-scoped kind without resourceRef', () => {
    mockUseEntity.mockReturnValue(makeEntity('ClusterComponentType'));
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    const { result } = renderHook(() => useResourceDefinitionPermission());

    expect(result.current.canUpdate).toBe(true);
    expect(result.current.canDelete).toBe(true);

    // Verify no resourceRef for cluster-scoped kind
    for (const call of mockUsePermission.mock.calls) {
      expect(call[0]).not.toHaveProperty('resourceRef');
    }
  });

  it('defaults to denied for unknown entity kind', () => {
    mockUseEntity.mockReturnValue(makeEntity('UnknownKind'));
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    const { result } = renderHook(() => useResourceDefinitionPermission());

    expect(result.current.canUpdate).toBe(false);
    expect(result.current.canDelete).toBe(false);
    expect(result.current.updateDeniedTooltip).toBeTruthy();
    expect(result.current.deleteDeniedTooltip).toBeTruthy();
  });

  it('returns loading state', () => {
    mockUsePermission.mockReturnValue({ allowed: false, loading: true });
    const { result } = renderHook(() => useResourceDefinitionPermission());

    expect(result.current.loading).toBe(true);
    expect(result.current.updateDeniedTooltip).toBe('');
    expect(result.current.deleteDeniedTooltip).toBe('');
  });

  it('returns denied tooltips when not allowed', () => {
    mockUsePermission.mockReturnValue({ allowed: false, loading: false });
    const { result } = renderHook(() => useResourceDefinitionPermission());

    expect(result.current.canUpdate).toBe(false);
    expect(result.current.canDelete).toBe(false);
    expect(result.current.updateDeniedTooltip).toBeTruthy();
    expect(result.current.deleteDeniedTooltip).toBeTruthy();
  });
});
