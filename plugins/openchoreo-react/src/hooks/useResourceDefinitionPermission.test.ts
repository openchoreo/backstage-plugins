import { renderHook } from '@testing-library/react';
import {
  openchoreoResourceUpdatePermission,
  openchoreoResourceDeletePermission,
  openchoreoProjectTypeUpdatePermission,
  openchoreoProjectTypeDeletePermission,
  openchoreoClusterProjectTypeUpdatePermission,
  openchoreoClusterProjectTypeDeletePermission,
  openchoreoNotificationChannelUpdatePermission,
  openchoreoNotificationChannelDeletePermission,
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

// resourceType-aware update hook. By default it passes through the base
// `usePermission` result for resources. Individual tests override it to
// simulate an ABAC resourceType deny.
const mockUseResourceUpdateContextPermission = jest.fn();
jest.mock('./useResourceUpdateContextPermission', () => ({
  useResourceUpdateContextPermission: () =>
    mockUseResourceUpdateContextPermission(),
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
    // Default: mirror the base usePermission result. Read the last recorded
    // result instead of re-invoking the mock, which would dirty mock.calls.
    mockUseComponentUpdateContextPermission.mockImplementation(() => {
      const { results } = mockUsePermission.mock;
      const base = results[results.length - 1]?.value;
      return {
        canUpdateComponent: base?.allowed ?? false,
        loading: base?.loading ?? false,
      };
    });
    mockUseResourceUpdateContextPermission.mockImplementation(() => {
      const { results } = mockUsePermission.mock;
      const base = results[results.length - 1]?.value;
      return {
        canUpdateResource: base?.allowed ?? false,
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

  it('wires ProjectType to resource-scoped update + delete permissions', () => {
    mockUseEntity.mockReturnValue(makeEntity('ProjectType'));
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    const { result } = renderHook(() => useResourceDefinitionPermission());

    expect(result.current.canUpdate).toBe(true);
    expect(result.current.canDelete).toBe(true);

    const inputs = mockUsePermission.mock.calls.map(c => c[0]).filter(Boolean);
    const perms = inputs.map(i => i.permission);
    expect(perms).toContain(openchoreoProjectTypeUpdatePermission);
    expect(perms).toContain(openchoreoProjectTypeDeletePermission);
    // Namespace-scoped: resourceRef must be passed.
    for (const input of inputs) {
      expect(input).toHaveProperty('resourceRef');
    }
  });

  it('wires ObservabilityAlertsNotificationChannel to resource-scoped update + delete permissions', () => {
    mockUseEntity.mockReturnValue(
      makeEntity('ObservabilityAlertsNotificationChannel'),
    );
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    const { result } = renderHook(() => useResourceDefinitionPermission());

    expect(result.current.canUpdate).toBe(true);
    expect(result.current.canDelete).toBe(true);

    const inputs = mockUsePermission.mock.calls.map(c => c[0]).filter(Boolean);
    const perms = inputs.map(i => i.permission);
    expect(perms).toContain(openchoreoNotificationChannelUpdatePermission);
    expect(perms).toContain(openchoreoNotificationChannelDeletePermission);
    // Namespace-scoped: resourceRef must be passed.
    for (const input of inputs) {
      expect(input).toHaveProperty('resourceRef');
    }
  });

  it('wires ClusterProjectType to cluster-scoped update + delete permissions', () => {
    mockUseEntity.mockReturnValue(makeEntity('ClusterProjectType'));
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    const { result } = renderHook(() => useResourceDefinitionPermission());

    expect(result.current.canUpdate).toBe(true);
    expect(result.current.canDelete).toBe(true);

    const inputs = mockUsePermission.mock.calls.map(c => c[0]).filter(Boolean);
    const perms = inputs.map(i => i.permission);
    expect(perms).toContain(openchoreoClusterProjectTypeUpdatePermission);
    expect(perms).toContain(openchoreoClusterProjectTypeDeletePermission);
    // Cluster-scoped: no resourceRef.
    for (const input of inputs) {
      expect(input).not.toHaveProperty('resourceRef');
    }
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

  it('flips canUpdate to false for a resource when resourceType ABAC denies', () => {
    mockUseEntity.mockReturnValue(makeEntity('Resource'));
    // Base RBAC allows, but the resourceType-aware hook denies (ABAC condition).
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    mockUseResourceUpdateContextPermission.mockReturnValue({
      canUpdateResource: false,
      loading: false,
    });

    const { result } = renderHook(() => useResourceDefinitionPermission());

    expect(result.current.canUpdate).toBe(false);
    expect(result.current.updateDeniedTooltip).toBeTruthy();
    // Delete is unaffected by the resourceType condition.
    expect(result.current.canDelete).toBe(true);
  });

  it('does not apply the resourceType condition to non-resource kinds', () => {
    mockUseEntity.mockReturnValue(makeEntity('TraitType'));
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    // Even if the context hook would deny, a non-resource kind ignores it.
    mockUseResourceUpdateContextPermission.mockReturnValue({
      canUpdateResource: false,
      loading: false,
    });

    const { result } = renderHook(() => useResourceDefinitionPermission());

    expect(result.current.canUpdate).toBe(true);
    expect(result.current.canDelete).toBe(true);
  });
});
