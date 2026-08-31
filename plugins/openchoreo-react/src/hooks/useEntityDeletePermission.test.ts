import { renderHook } from '@testing-library/react';
import type { Entity } from '@backstage/catalog-model';
import {
  openchoreoResourceDeletePermission,
  openchoreoComponentUpdatePermission,
  openchoreoProjectUpdatePermission,
  openchoreoClusterComponentTypeDeletePermission,
} from '@openchoreo/backstage-plugin-common';
import { useEntityDeletePermission } from './useEntityDeletePermission';

const mockUsePermission = jest.fn();
jest.mock('@backstage/plugin-permission-react', () => ({
  usePermission: (...args: any[]) => mockUsePermission(...args),
}));

const makeEntity = (kind: string): Entity => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind,
  metadata: { name: 'test', namespace: 'default' },
});

describe('useEntityDeletePermission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
  });

  it('checks the delete permission with the entity ref for resource-scoped kinds', () => {
    const { result } = renderHook(() =>
      useEntityDeletePermission(makeEntity('Resource')),
    );

    expect(mockUsePermission).toHaveBeenCalledWith({
      permission: openchoreoResourceDeletePermission,
      resourceRef: 'resource:default/test',
    });
    expect(result.current.canDelete).toBe(true);
    expect(result.current.deniedTooltip).toBe('');
  });

  it('checks a basic permission without resourceRef for cluster-scoped kinds', () => {
    renderHook(() =>
      useEntityDeletePermission(makeEntity('ClusterComponentType')),
    );

    expect(mockUsePermission).toHaveBeenCalledWith({
      permission: openchoreoClusterComponentTypeDeletePermission,
    });
  });

  it.each([
    ['Component', openchoreoComponentUpdatePermission],
    ['System', openchoreoProjectUpdatePermission],
  ])('falls back to the update permission for %s', (kind, permission) => {
    renderHook(() => useEntityDeletePermission(makeEntity(kind)));

    expect(mockUsePermission).toHaveBeenCalledWith({
      permission,
      resourceRef: `${kind.toLowerCase()}:default/test`,
    });
  });

  it('denies kinds without a mapped permission even when allowed', () => {
    const { result } = renderHook(() =>
      useEntityDeletePermission(makeEntity('SomethingElse')),
    );

    expect(result.current.canDelete).toBe(false);
    expect(result.current.deniedTooltip).toBe(
      'You do not have permission to delete this resource',
    );
  });

  it('reports the denied tooltip when the permission is denied', () => {
    mockUsePermission.mockReturnValue({ allowed: false, loading: false });

    const { result } = renderHook(() =>
      useEntityDeletePermission(makeEntity('Resource')),
    );

    expect(result.current.canDelete).toBe(false);
    expect(result.current.deniedTooltip).toBe(
      'You do not have permission to delete this resource',
    );
  });

  it('keeps the tooltip empty while the check is loading', () => {
    mockUsePermission.mockReturnValue({ allowed: false, loading: true });

    const { result } = renderHook(() =>
      useEntityDeletePermission(makeEntity('Resource')),
    );

    expect(result.current.canDelete).toBe(false);
    expect(result.current.loading).toBe(true);
    expect(result.current.deniedTooltip).toBe('');
  });
});
