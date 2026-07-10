import { renderHook, waitFor, act } from '@testing-library/react';
import { Entity } from '@backstage/catalog-model';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import type { Environment } from '../hooks/useEnvironmentData';
import { useDeploymentStatus } from './useDeploymentStatus';

const entity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'checkout', namespace: 'default' },
};

jest.mock('@backstage/plugin-catalog-react', () => ({
  ...jest.requireActual('@backstage/plugin-catalog-react'),
  useEntity: () => ({ entity }),
}));

function makeEnv(
  name: string,
  status: Environment['deployment'] = { status: 'Ready' },
): Environment {
  return { name, deployment: status, endpoints: [] };
}

function renderUseDeploymentStatus(fetchEnvironmentInfo: jest.Mock) {
  const client = { fetchEnvironmentInfo } as any;
  return renderHook(() => useDeploymentStatus(), {
    wrapper: createQueryWrapper([[openChoreoClientApiRef, client]]),
  });
}

describe('useDeploymentStatus', () => {
  it('starts loading with no environments', () => {
    const { result } = renderUseDeploymentStatus(
      jest.fn().mockReturnValue(new Promise(() => {})),
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.environments).toEqual([]);
    expect(result.current.refreshing).toBe(false);
  });

  it('loads deployment status across environments', async () => {
    const fetchEnvironmentInfo = jest
      .fn()
      .mockResolvedValue([makeEnv('development'), makeEnv('production')]);
    const { result } = renderUseDeploymentStatus(fetchEnvironmentInfo);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.environments.map(e => e.name)).toEqual([
      'development',
      'production',
    ]);
    expect(result.current.error).toBeNull();
    expect(result.current.isForbidden).toBe(false);
    // Background-refresh flag is exposed as `refreshing` and settled.
    expect(result.current.refreshing).toBe(false);
  });

  it('keeps data and flips refreshing during a background refresh', async () => {
    let releaseSecond: (v: Environment[]) => void = () => {};
    const secondPending = new Promise<Environment[]>(resolve => {
      releaseSecond = resolve;
    });
    const fetchEnvironmentInfo = jest
      .fn()
      .mockResolvedValueOnce([makeEnv('development')])
      .mockReturnValueOnce(secondPending);
    const { result } = renderUseDeploymentStatus(fetchEnvironmentInfo);

    await waitFor(() => expect(result.current.environments).toHaveLength(1));

    await act(async () => {
      result.current.refresh().catch(() => {});
    });

    await waitFor(() => expect(result.current.refreshing).toBe(true));
    expect(result.current.loading).toBe(false);
    expect(result.current.environments).toHaveLength(1);

    await act(async () => {
      releaseSecond([makeEnv('development'), makeEnv('production')]);
      await secondPending;
    });

    await waitFor(() => expect(result.current.environments).toHaveLength(2));
    expect(result.current.refreshing).toBe(false);
  });
});
