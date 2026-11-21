import { renderHook } from '@testing-library/react';
import { openchoreoResourceReleaseBindingRollbackPermission } from '@openchoreo/backstage-plugin-common';
import { useResourceReleaseBindingRollbackPermission } from './useResourceReleaseBindingRollbackPermission';

const mockEnvScoped = jest.fn();

jest.mock('@backstage/plugin-catalog-react', () => ({
  useEntity: () => ({
    entity: {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Resource',
      metadata: { name: 'orders-db', namespace: 'default' },
    },
  }),
}));
jest.mock('./useEnvScopedPermission', () => ({
  useEnvScopedPermission: (args: unknown) => mockEnvScoped(args),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useResourceReleaseBindingRollbackPermission', () => {
  it('checks resourcereleasebinding rollback on the Resource, scoped to the env', () => {
    mockEnvScoped.mockReturnValue({ allowed: true, loading: false });

    const { result } = renderHook(() =>
      useResourceReleaseBindingRollbackPermission('development'),
    );

    expect(mockEnvScoped).toHaveBeenCalledWith({
      permission: openchoreoResourceReleaseBindingRollbackPermission,
      resourceRef: 'resource:default/orders-db',
      environment: 'development',
    });
    expect(result.current).toEqual({
      canRollback: true,
      loading: false,
      deniedTooltip: '',
    });
  });

  it('explains a denial for the environment', () => {
    mockEnvScoped.mockReturnValue({ allowed: false, loading: false });

    const { result } = renderHook(() =>
      useResourceReleaseBindingRollbackPermission('production'),
    );

    expect(result.current.canRollback).toBe(false);
    expect(result.current.deniedTooltip).toBe(
      'You do not have permission to roll back the resource in production',
    );
  });

  it('shows no tooltip while the check is loading', () => {
    mockEnvScoped.mockReturnValue({ allowed: false, loading: true });

    const { result } = renderHook(() =>
      useResourceReleaseBindingRollbackPermission('production'),
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.deniedTooltip).toBe('');
  });
});
