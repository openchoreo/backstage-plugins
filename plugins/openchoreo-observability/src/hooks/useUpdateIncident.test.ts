import { renderHook, waitFor, act } from '@testing-library/react';
import { useApi } from '@backstage/core-plugin-api';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { useUpdateIncident } from './useUpdateIncident';

jest.mock('@backstage/core-plugin-api', () => {
  const actual = jest.requireActual('@backstage/core-plugin-api');
  return {
    ...actual,
    useApi: jest.fn(),
  };
});

describe('useUpdateIncident', () => {
  const updateIncidentStatus = jest.fn();

  const incident = {
    incidentId: 'inc-1',
    namespaceName: 'dev',
    environmentName: 'development',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useApi as jest.Mock).mockReturnValue({ updateIncidentStatus });
  });

  it('starts idle with no error', () => {
    const { result } = renderHook(() => useUpdateIncident(), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current.updating).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('calls the client with the incident ids and new status', async () => {
    updateIncidentStatus.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useUpdateIncident(), {
      wrapper: createQueryWrapper(),
    });

    await act(async () => {
      await result.current.updateIncident(incident as any, 'acknowledged');
    });

    expect(updateIncidentStatus).toHaveBeenCalledWith(
      'inc-1',
      'acknowledged',
      'dev',
      'development',
    );
    expect(result.current.error).toBeNull();
  });

  it('re-throws and records the error when the client rejects', async () => {
    const boom = new Error('update failed');
    updateIncidentStatus.mockRejectedValueOnce(boom);

    const { result } = renderHook(() => useUpdateIncident(), {
      wrapper: createQueryWrapper(),
    });

    await act(async () => {
      await expect(
        result.current.updateIncident(incident as any, 'resolved'),
      ).rejects.toBe(boom);
    });

    await waitFor(() => expect(result.current.error).toBe('update failed'));
  });

  it('re-throws for a guard failure when namespace/environment are missing', async () => {
    const { result } = renderHook(() => useUpdateIncident(), {
      wrapper: createQueryWrapper(),
    });

    await act(async () => {
      await expect(
        result.current.updateIncident(
          { incidentId: 'inc-2' } as any,
          'acknowledged',
        ),
      ).rejects.toThrow('missing namespace or environment');
    });

    expect(updateIncidentStatus).not.toHaveBeenCalled();
  });
});
