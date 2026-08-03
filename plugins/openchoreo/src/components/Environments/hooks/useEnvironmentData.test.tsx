import { renderHook, waitFor, act } from '@testing-library/react';
import { ResponseError } from '@backstage/errors';
import { Entity } from '@backstage/catalog-model';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { useEnvironmentData, type Environment } from './useEnvironmentData';

const entity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'checkout', namespace: 'default' },
};

function makeEnv(name: string): Environment {
  return { name, deployment: { status: 'Ready' }, endpoints: [] };
}

function renderUseEnvironmentData(fetchEnvironmentInfo: jest.Mock) {
  const client = { fetchEnvironmentInfo } as any;
  return renderHook(() => useEnvironmentData(entity), {
    wrapper: createQueryWrapper([[openChoreoClientApiRef, client]]),
  });
}

describe('useEnvironmentData', () => {
  it('loads environments and exposes them with the legacy return shape', async () => {
    const fetchEnvironmentInfo = jest
      .fn()
      .mockResolvedValue([makeEnv('development')]);
    const { result } = renderUseEnvironmentData(fetchEnvironmentInfo);

    expect(result.current.loading).toBe(true);
    expect(result.current.environments).toEqual([]);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.environments).toEqual([makeEnv('development')]);
    expect(result.current.isRefetching).toBe(false);
    expect(result.current.isForbidden).toBe(false);
  });

  it('keeps environments and flips isRefetching on a background refetch', async () => {
    // Hold the refetch open so the in-flight refresh is observable before it
    // resolves (an instant resolve flips isRefetching true→false too fast).
    let releaseSecond: (v: Environment[]) => void = () => {};
    const secondPending = new Promise<Environment[]>(resolve => {
      releaseSecond = resolve;
    });
    const fetchEnvironmentInfo = jest
      .fn()
      .mockResolvedValueOnce([makeEnv('development')])
      .mockReturnValueOnce(secondPending);
    const { result } = renderUseEnvironmentData(fetchEnvironmentInfo);

    await waitFor(() => expect(result.current.environments).toHaveLength(1));

    // refetch() now returns a Promise (held open by the pending second fetch);
    // kick it inside act and swallow so it doesn't leak an unhandled rejection.
    await act(async () => {
      result.current.refetch().catch(() => {});
    });

    await waitFor(() => expect(result.current.isRefetching).toBe(true));
    // Data stays on screen during the refresh — never blanks to a first load.
    expect(result.current.loading).toBe(false);
    expect(result.current.environments).toHaveLength(1);

    await act(async () => {
      releaseSecond([makeEnv('development'), makeEnv('staging')]);
      await secondPending;
    });

    await waitFor(() => expect(result.current.environments).toHaveLength(2));
    expect(result.current.isRefetching).toBe(false);
  });

  it('flags a 403 as forbidden and keeps environments empty', async () => {
    const forbidden = await ResponseError.fromResponse(
      new Response(JSON.stringify({ error: { message: 'Forbidden' } }), {
        status: 403,
        statusText: 'Forbidden',
        headers: { 'content-type': 'application/json' },
      }),
    );
    const fetchEnvironmentInfo = jest.fn().mockRejectedValue(forbidden);
    const { result } = renderUseEnvironmentData(fetchEnvironmentInfo);

    await waitFor(() => expect(result.current.isForbidden).toBe(true));
    expect(result.current.environments).toEqual([]);
  });
});
