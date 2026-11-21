import { renderHook } from '@testing-library/react';
import {
  openchoreoReleaseBindingDeleteRevisionPermission,
  openchoreoResourceReleaseBindingDeleteRevisionPermission,
} from '@openchoreo/backstage-plugin-common';
import {
  useReleaseBindingDeleteRevisionPermission,
  useResourceReleaseBindingDeleteRevisionPermission,
} from './useBindingRevisionDeletePermission';

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

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useReleaseBindingDeleteRevisionPermission', () => {
  it('checks releasebinding delete-revision, scoped to the env', () => {
    mockEnvScoped.mockReturnValue({ allowed: true, loading: false });

    const { result } = renderHook(() =>
      useReleaseBindingDeleteRevisionPermission('development'),
    );

    expect(mockEnvScoped).toHaveBeenCalledWith({
      permission: openchoreoReleaseBindingDeleteRevisionPermission,
      resourceRef: 'component:default/frontend',
      environment: 'development',
    });
    expect(result.current).toEqual({
      canDeleteRevision: true,
      loading: false,
      deniedTooltip: '',
    });
  });

  it('explains a denial', () => {
    mockEnvScoped.mockReturnValue({ allowed: false, loading: false });

    const { result } = renderHook(() =>
      useReleaseBindingDeleteRevisionPermission('production'),
    );

    expect(result.current.canDeleteRevision).toBe(false);
    expect(result.current.deniedTooltip).toBe(
      'You do not have permission to delete revisions in production',
    );
  });
});

describe('useResourceReleaseBindingDeleteRevisionPermission', () => {
  it('checks resourcereleasebinding delete-revision', () => {
    mockEnvScoped.mockReturnValue({ allowed: false, loading: true });

    const { result } = renderHook(() =>
      useResourceReleaseBindingDeleteRevisionPermission('development'),
    );

    expect(mockEnvScoped).toHaveBeenCalledWith(
      expect.objectContaining({
        permission: openchoreoResourceReleaseBindingDeleteRevisionPermission,
      }),
    );
    expect(result.current.deniedTooltip).toBe('');
  });
});
