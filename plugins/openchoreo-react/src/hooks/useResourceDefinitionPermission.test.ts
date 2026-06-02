import { renderHook } from '@testing-library/react';
import {
  openchoreoResourceUpdatePermission,
  openchoreoResourceDeletePermission,
} from '@openchoreo/backstage-plugin-common';
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

// componentType-aware update hook. By default it passes through the base
// `usePermission` result for components (authz off / no annotation). Individual
// tests override it to simulate an ABAC componentType deny.
const mockUseComponentUpdateContextPermission = jest.fn();
jest.mock('./useComponentUpdateContextPermission', () => ({
  useComponentUpdateContextPermission: () =>
    mockUseComponentUpdateContextPermission(),
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
    // Default: the componentType-aware hook degrades to base — mirror whatever
    // the base usePermission mock returns so component-kind cases behave like
    // plain RBAC unless a test overrides this.
    mockUseComponentUpdateContextPermission.mockImplementation(() => {
      const base = mockUsePermission();
      return {
        canUpdateComponent: base?.allowed ?? false,
        loading: base?.loading ?? false,
      };
    });
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

    // Verify no resourceRef for cluster-scoped kind.
    const inputs = mockUsePermission.mock.calls
      .map(call => call[0])
      .filter(Boolean);
    expect(inputs.length).toBeGreaterThan(0);
    for (const input of inputs) {
      expect(input).not.toHaveProperty('resourceRef');
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

  it('wires the Resource entry to distinct update + delete permissions', () => {
    mockUseEntity.mockReturnValue(makeEntity('Resource'));
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    renderHook(() => useResourceDefinitionPermission());

    const calls = mockUsePermission.mock.calls
      .map(c => c[0])
      .filter(Boolean)
      .map(input => input.permission);
    expect(calls).toContain(openchoreoResourceUpdatePermission);
    expect(calls).toContain(openchoreoResourceDeletePermission);
  });

  it('flips canUpdate to false for a component when componentType ABAC denies', () => {
    // Base RBAC allows, but the componentType-aware hook denies (ABAC condition).
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    mockUseComponentUpdateContextPermission.mockReturnValue({
      canUpdateComponent: false,
      loading: false,
    });

    const { result } = renderHook(() => useResourceDefinitionPermission());

    expect(result.current.canUpdate).toBe(false);
    expect(result.current.updateDeniedTooltip).toBeTruthy();
    // Delete is unaffected by the componentType condition.
    expect(result.current.canDelete).toBe(true);
  });

  it('does not apply the componentType condition to non-component kinds', () => {
    mockUseEntity.mockReturnValue(makeEntity('TraitType'));
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    // Even if the context hook would deny, a non-component kind ignores it.
    mockUseComponentUpdateContextPermission.mockReturnValue({
      canUpdateComponent: false,
      loading: false,
    });

    const { result } = renderHook(() => useResourceDefinitionPermission());

    expect(result.current.canUpdate).toBe(true);
    expect(result.current.canDelete).toBe(true);
  });
});
