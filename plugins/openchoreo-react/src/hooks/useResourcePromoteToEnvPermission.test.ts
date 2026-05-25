import { renderHook } from '@testing-library/react';
import { useResourcePromoteToEnvPermission } from './useResourcePromoteToEnvPermission';

const mockCreate = jest.fn();
const mockUpdate = jest.fn();

jest.mock('./useResourceReleaseBindingCreatePermission', () => ({
  useResourceReleaseBindingCreatePermission: (env?: string) => mockCreate(env),
}));
jest.mock('./useResourceReleaseBindingUpdatePermission', () => ({
  useResourceReleaseBindingUpdatePermission: (env?: string) => mockUpdate(env),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useResourcePromoteToEnvPermission', () => {
  it('allows when both create and update permissions are allowed', () => {
    mockCreate.mockReturnValue({
      canCreate: true,
      loading: false,
      deniedTooltip: '',
    });
    mockUpdate.mockReturnValue({
      canUpdate: true,
      loading: false,
      deniedTooltip: '',
    });

    const { result } = renderHook(() =>
      useResourcePromoteToEnvPermission('production'),
    );

    expect(result.current.canPromote).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(result.current.deniedTooltip).toBe('');
  });

  it('forwards the target env name to both underlying hooks', () => {
    mockCreate.mockReturnValue({
      canCreate: true,
      loading: false,
      deniedTooltip: '',
    });
    mockUpdate.mockReturnValue({
      canUpdate: true,
      loading: false,
      deniedTooltip: '',
    });

    renderHook(() => useResourcePromoteToEnvPermission('production'));

    expect(mockCreate).toHaveBeenCalledWith('production');
    expect(mockUpdate).toHaveBeenCalledWith('production');
  });

  it('denies and surfaces the create-denied tooltip when only create is denied', () => {
    mockCreate.mockReturnValue({
      canCreate: false,
      loading: false,
      deniedTooltip: 'no deploy to production',
    });
    mockUpdate.mockReturnValue({
      canUpdate: true,
      loading: false,
      deniedTooltip: '',
    });

    const { result } = renderHook(() =>
      useResourcePromoteToEnvPermission('production'),
    );

    expect(result.current.canPromote).toBe(false);
    expect(result.current.deniedTooltip).toBe('no deploy to production');
  });

  it('denies and surfaces the update-denied tooltip when only update is denied', () => {
    mockCreate.mockReturnValue({
      canCreate: true,
      loading: false,
      deniedTooltip: '',
    });
    mockUpdate.mockReturnValue({
      canUpdate: false,
      loading: false,
      deniedTooltip: 'no update on production',
    });

    const { result } = renderHook(() =>
      useResourcePromoteToEnvPermission('production'),
    );

    expect(result.current.canPromote).toBe(false);
    expect(result.current.deniedTooltip).toBe('no update on production');
  });

  it('uses a generic message when both are denied', () => {
    mockCreate.mockReturnValue({
      canCreate: false,
      loading: false,
      deniedTooltip: 'no deploy',
    });
    mockUpdate.mockReturnValue({
      canUpdate: false,
      loading: false,
      deniedTooltip: 'no update',
    });

    const { result } = renderHook(() =>
      useResourcePromoteToEnvPermission('production'),
    );

    expect(result.current.canPromote).toBe(false);
    expect(result.current.deniedTooltip).toBe(
      'You do not have permission to promote to production',
    );
  });

  it('reports loading when either half is loading', () => {
    mockCreate.mockReturnValue({
      canCreate: false,
      loading: true,
      deniedTooltip: '',
    });
    mockUpdate.mockReturnValue({
      canUpdate: true,
      loading: false,
      deniedTooltip: '',
    });

    const { result } = renderHook(() =>
      useResourcePromoteToEnvPermission('production'),
    );

    expect(result.current.loading).toBe(true);
    // Tooltip suppressed while loading.
    expect(result.current.deniedTooltip).toBe('');
  });
});
