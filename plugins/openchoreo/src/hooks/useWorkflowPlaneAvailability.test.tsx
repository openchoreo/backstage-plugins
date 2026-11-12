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

  it('keeps the queued check timeout when the earlier request cleanup runs', async () => {
    jest.useFakeTimers();
    const resolvePlaneRequests: Array<
      (value: Record<string, unknown>) => void
    > = [];
    let planeRequests = 0;
    const client = {
      getResourceDefinition: jest.fn((kind: string) => {
        if (kind === 'workflows') {
          return Promise.resolve({
            spec: {
              workflowPlaneRef: { kind: 'WorkflowPlane', name: 'wp' },
            },
          });
        }

        planeRequests += 1;
        return new Promise<Record<string, unknown>>(resolve => {
          resolvePlaneRequests.push(resolve);
        });
      }),
    };
    const { result, unmount } = renderHook(
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

    await waitFor(() => expect(planeRequests).toBe(1));
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await act(async () => {
      resolvePlaneRequests[0]({
        status: { agentConnection: { connected: true } },
      });
      await Promise.resolve();
    });
    await waitFor(() => expect(planeRequests).toBe(2));

    await act(async () => {
      jest.advanceTimersByTime(15_000);
      await Promise.resolve();
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toContain('timed out');

    unmount();
  });

  it('queues one focus refresh after a timed-out request settles', async () => {
    jest.useFakeTimers();
    const resolvePlaneRequests: Array<
      (value: Record<string, unknown>) => void
    > = [];
    let planeRequests = 0;
    const client = {
      getResourceDefinition: jest.fn((kind: string) => {
        if (kind === 'workflows') {
          return Promise.resolve({
            spec: {
              workflowPlaneRef: { kind: 'WorkflowPlane', name: 'wp' },
            },
          });
        }

        planeRequests += 1;
        return new Promise<Record<string, unknown>>(resolve => {
          resolvePlaneRequests.push(resolve);
        });
      }),
    };
    const { result, unmount } = renderHook(
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

    await waitFor(() => expect(planeRequests).toBe(1));
    await act(async () => {
      jest.advanceTimersByTime(15_000);
      await Promise.resolve();
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.status).toBe('error'));

    act(() => {
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('focus'));
    });
    expect(planeRequests).toBe(1);

    await act(async () => {
      resolvePlaneRequests[0]({
        status: { agentConnection: { connected: true } },
      });
    });
    await waitFor(() => expect(planeRequests).toBe(2));
    expect(result.current).toMatchObject({
      status: 'error',
      error: expect.stringContaining('timed out'),
    });

    await act(async () => {
      resolvePlaneRequests[1]({
        status: { agentConnection: { connected: false } },
      });
    });
    await waitFor(() => expect(result.current.status).toBe('disconnected'));

    const requestCount = client.getResourceDefinition.mock.calls.length;
    unmount();
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(client.getResourceDefinition).toHaveBeenCalledTimes(requestCount);
  });

  it('rechecks on window focus without clearing the last known status', async () => {
    let resolveRefresh: ((value: Record<string, unknown>) => void) | undefined;
    let planeRequests = 0;
    const client = {
      getResourceDefinition: jest.fn((kind: string) => {
        if (kind === 'workflows') {
          return Promise.resolve({
            spec: {
              workflowPlaneRef: { kind: 'WorkflowPlane', name: 'wp' },
            },
          });
        }

        planeRequests += 1;
        if (planeRequests === 1) {
          return Promise.resolve({
            status: { agentConnection: { connected: true } },
          });
        }
        return new Promise<Record<string, unknown>>(resolve => {
          resolveRefresh = resolve;
        });
      }),
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

    await waitFor(() => expect(result.current.status).toBe('connected'));

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await waitFor(() => expect(planeRequests).toBe(2));
    expect(result.current.status).toBe('connected');

    await act(async () => {
      resolveRefresh?.({
        status: { agentConnection: { connected: false } },
      });
    });
    await waitFor(() => expect(result.current.status).toBe('disconnected'));
  });

  it('ignores a late result after the workflow input changes', async () => {
    let resolveOldWorkflow:
      | ((value: Record<string, unknown>) => void)
      | undefined;
    const client = {
      getResourceDefinition: jest.fn(
        (kind: string, _namespace: string, name: string) => {
          if (kind === 'workflows' && name === 'old') {
            return new Promise<Record<string, unknown>>(resolve => {
              resolveOldWorkflow = resolve;
            });
          }
          if (kind === 'workflows') {
            return Promise.resolve({
              spec: {
                workflowPlaneRef: { kind: 'WorkflowPlane', name: 'new-plane' },
              },
            });
          }
          return Promise.resolve({
            status: { agentConnection: { connected: true } },
          });
        },
      ),
    };
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TestApiProvider apis={[[openChoreoClientApiRef, client]]}>
        {children}
      </TestApiProvider>
    );
    const { result, rerender } = renderHook(
      ({ workflowName }: { workflowName: string }) =>
        useWorkflowPlaneAvailability({
          namespaceName: 'team-a',
          workflowName,
        }),
      { initialProps: { workflowName: 'old' }, wrapper },
    );

    rerender({ workflowName: 'new' });
    await waitFor(() => expect(result.current.status).toBe('connected'));
    expect(result.current.planeName).toBe('new-plane');

    await act(async () => {
      resolveOldWorkflow?.({
        spec: {
          workflowPlaneRef: { kind: 'WorkflowPlane', name: 'old-plane' },
        },
      });
      await Promise.resolve();
    });

    expect(result.current).toMatchObject({
      status: 'connected',
      planeName: 'new-plane',
    });
  });

  it('reports an error instead of throwing when the base client API is not registered', async () => {
    const { result } = renderHook(
      () =>
        useWorkflowPlaneAvailability({
          namespaceName: 'team-a',
          workflowName: 'build',
        }),
      {
        wrapper: ({ children }) => (
          <TestApiProvider apis={[]}>{children}</TestApiProvider>
        ),
      },
    );

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toContain(
      'OpenChoreo client API is not registered',
    );
  });
});
