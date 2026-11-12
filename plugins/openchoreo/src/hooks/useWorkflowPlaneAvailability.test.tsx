import { act, renderHook, waitFor } from '@testing-library/react';
import { ResponseError } from '@backstage/errors';
import { TestApiProvider } from '@backstage/test-utils';
import { openChoreoClientApiRef } from '../api/OpenChoreoClientApi';
import {
  checkWorkflowPlaneAvailability,
  useWorkflowPlaneAvailability,
} from './useWorkflowPlaneAvailability';

function responseError(status: number) {
  return ResponseError.fromResponse(
    new Response(JSON.stringify({ error: { message: 'request failed' } }), {
      status,
      statusText: status === 403 ? 'Forbidden' : 'Not Found',
      headers: { 'content-type': 'application/json' },
    }),
  );
}

function makeClient(
  getResourceDefinition: jest.Mock<Promise<Record<string, unknown>>, any>,
) {
  return { getResourceDefinition };
}

describe('checkWorkflowPlaneAvailability', () => {
  it('honors an explicit cluster plane on a namespaced workflow', async () => {
    const getResourceDefinition = jest
      .fn()
      .mockResolvedValueOnce({
        spec: {
          workflowPlaneRef: {
            kind: 'ClusterWorkflowPlane',
            name: 'default',
          },
        },
      })
      .mockResolvedValueOnce({
        status: { agentConnection: { connected: true } },
      });

    await expect(
      checkWorkflowPlaneAvailability(makeClient(getResourceDefinition), {
        namespaceName: 'team-a',
        workflowName: 'build',
      }),
    ).resolves.toMatchObject({
      status: 'connected',
      planeKind: 'ClusterWorkflowPlane',
      planeName: 'default',
    });

    expect(getResourceDefinition.mock.calls).toEqual([
      ['workflows', 'team-a', 'build'],
      ['clusterworkflowplanes', '', 'default'],
    ]);
  });

  it('honors an explicit namespace plane reference', async () => {
    const getResourceDefinition = jest
      .fn()
      .mockResolvedValueOnce({
        spec: {
          workflowPlaneRef: { kind: 'WorkflowPlane', name: 'custom' },
        },
      })
      .mockResolvedValueOnce({
        status: { agentConnection: { connected: true } },
      });

    await checkWorkflowPlaneAvailability(makeClient(getResourceDefinition), {
      namespaceName: 'team-a',
      workflowName: 'build',
    });

    expect(getResourceDefinition.mock.calls[1]).toEqual([
      'workflowplanes',
      'team-a',
      'custom',
    ]);
  });

  it('checks a namespaced default before falling back to the cluster default', async () => {
    const getResourceDefinition = jest
      .fn()
      .mockResolvedValueOnce({ spec: {} })
      .mockRejectedValueOnce(await responseError(404))
      .mockResolvedValueOnce({
        status: { agentConnection: { connected: true } },
      });

    const availability = await checkWorkflowPlaneAvailability(
      makeClient(getResourceDefinition),
      { namespaceName: 'team-a', workflowName: 'build' },
    );

    expect(availability).toMatchObject({
      status: 'connected',
      planeKind: 'ClusterWorkflowPlane',
      planeName: 'default',
    });
    expect(getResourceDefinition.mock.calls).toEqual([
      ['workflows', 'team-a', 'build'],
      ['workflowplanes', 'team-a', 'default'],
      ['clusterworkflowplanes', '', 'default'],
    ]);
  });

  it('uses the namespace-scoped default when it exists', async () => {
    const getResourceDefinition = jest
      .fn()
      .mockResolvedValueOnce({ spec: {} })
      .mockResolvedValueOnce({
        status: { agentConnection: { connected: true } },
      });

    await expect(
      checkWorkflowPlaneAvailability(makeClient(getResourceDefinition), {
        namespaceName: 'team-a',
        workflowName: 'build',
      }),
    ).resolves.toMatchObject({
      status: 'connected',
      planeKind: 'WorkflowPlane',
      planeName: 'default',
    });

    expect(getResourceDefinition.mock.calls).toEqual([
      ['workflows', 'team-a', 'build'],
      ['workflowplanes', 'team-a', 'default'],
    ]);
  });

  it('uses only the cluster default for a ClusterWorkflow without a reference', async () => {
    const getResourceDefinition = jest
      .fn()
      .mockResolvedValueOnce({ spec: {} })
      .mockResolvedValueOnce({
        status: { agentConnection: { connected: true } },
      });

    await checkWorkflowPlaneAvailability(makeClient(getResourceDefinition), {
      workflowKind: 'ClusterWorkflow',
      workflowName: 'shared-build',
    });

    expect(getResourceDefinition.mock.calls).toEqual([
      ['clusterworkflows', '', 'shared-build'],
      ['clusterworkflowplanes', '', 'default'],
    ]);
  });

  it('reports disconnected, missing, and unknown connection status distinctly', async () => {
    const disconnected = jest
      .fn()
      .mockResolvedValueOnce({
        spec: { workflowPlaneRef: { kind: 'WorkflowPlane', name: 'wp' } },
      })
      .mockResolvedValueOnce({
        status: { agentConnection: { connected: false } },
      });
    const missing = jest
      .fn()
      .mockResolvedValueOnce({
        spec: { workflowPlaneRef: { kind: 'WorkflowPlane', name: 'wp' } },
      })
      .mockRejectedValueOnce(await responseError(404));
    const unknown = jest
      .fn()
      .mockResolvedValueOnce({
        spec: { workflowPlaneRef: { kind: 'WorkflowPlane', name: 'wp' } },
      })
      .mockResolvedValueOnce({ status: {} });

    const input = { namespaceName: 'team-a', workflowName: 'build' };
    await expect(
      checkWorkflowPlaneAvailability(makeClient(disconnected), input),
    ).resolves.toMatchObject({ status: 'disconnected' });
    await expect(
      checkWorkflowPlaneAvailability(makeClient(missing), input),
    ).resolves.toMatchObject({ status: 'missing' });
    await expect(
      checkWorkflowPlaneAvailability(makeClient(unknown), input),
    ).resolves.toMatchObject({ status: 'unknown' });
  });

  it('reports an explicitly referenced missing plane and a forbidden plane check distinctly', async () => {
    const missing = jest
      .fn()
      .mockResolvedValueOnce({
        spec: {
          workflowPlaneRef: {
            kind: 'ClusterWorkflowPlane',
            name: 'default',
          },
        },
      })
      .mockRejectedValueOnce(await responseError(404));
    const forbidden = jest
      .fn()
      .mockResolvedValueOnce({
        spec: {
          workflowPlaneRef: {
            kind: 'ClusterWorkflowPlane',
            name: 'default',
          },
        },
      })
      .mockRejectedValueOnce(await responseError(403));

    const input = { namespaceName: 'team-a', workflowName: 'build' };
    await expect(
      checkWorkflowPlaneAvailability(makeClient(missing), input),
    ).resolves.toMatchObject({ status: 'missing' });
    await expect(
      checkWorkflowPlaneAvailability(makeClient(forbidden), input),
    ).resolves.toMatchObject({ status: 'forbidden' });
  });

  it('distinguishes forbidden and unexpected API errors from missing planes', async () => {
    const forbidden = jest.fn().mockRejectedValue(await responseError(403));
    const unexpected = jest
      .fn()
      .mockResolvedValueOnce({ spec: {} })
      .mockRejectedValueOnce(new Error('network unavailable'));

    await expect(
      checkWorkflowPlaneAvailability(makeClient(forbidden), {
        namespaceName: 'team-a',
        workflowName: 'build',
      }),
    ).resolves.toMatchObject({ status: 'forbidden' });
    await expect(
      checkWorkflowPlaneAvailability(makeClient(unexpected), {
        namespaceName: 'team-a',
        workflowName: 'build',
      }),
    ).resolves.toMatchObject({
      status: 'error',
      error: 'network unavailable',
    });
  });
});

describe('useWorkflowPlaneAvailability', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('leaves loading after a slow request by timing out into an error state', async () => {
    jest.useFakeTimers();
    const client = {
      getResourceDefinition: jest.fn(
        () => new Promise<Record<string, unknown>>(() => {}),
      ),
    };
    const { result } = renderHook(
      () =>
        useWorkflowPlaneAvailability({
          namespaceName: 'team-a',
          workflowName: 'build',
        }),
      {
        wrapper: ({ children }) => (
          <TestApiProvider apis={[[openChoreoClientApiRef, client]]}>
            {children}
          </TestApiProvider>
        ),
      },
    );

    expect(result.current.status).toBe('loading');
    await act(async () => {
      jest.advanceTimersByTime(15_000);
      await Promise.resolve();
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toContain('timed out');
  });
});
