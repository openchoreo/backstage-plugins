import { renderHook } from '@testing-library/react';
import { useReleaseBindingRollbackPermission } from './useReleaseBindingRollbackPermission';

const mockEnvScoped = jest.fn();

jest.mock('@backstage/plugin-catalog-react', () => ({
  useEntity: () => ({
    entity: {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: { name: 'frontend', namespace: 'default' },
    },
  }),
}));
jest.mock('./useEnvScopedPermission', () => ({
  useEnvScopedPermission: (args: unknown) => mockEnvScoped(args),
}));

describe('useReleaseBindingRollbackPermission', () => {
  it('allows a rollback once the check for the environment allows it', () => {
    mockEnvScoped.mockReturnValue({ allowed: true, loading: false });
    const { result } = renderHook(() =>
      useReleaseBindingRollbackPermission('development'),
    );
    expect(result.current.canRollback).toBe(true);
  });

  it('does not allow a rollback while the check for the environment is loading', () => {
    // The previous environment's allowed result is still reported meanwhile.
    mockEnvScoped.mockReturnValue({ allowed: true, loading: true });
    const { result } = renderHook(() =>
      useReleaseBindingRollbackPermission('production'),
    );
    expect(result.current.canRollback).toBe(false);
    expect(result.current.loading).toBe(true);
  });
});
