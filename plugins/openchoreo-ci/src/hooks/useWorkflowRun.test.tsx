/**
 * Tests for useWorkflowRun.
 *
 * The hook wraps a single useOpenChoreoQuery that fetches a workflow-run's
 * details from the ci backend. It resolves the component/project/namespace
 * via useComponentEntityDetails, so we stub that (keeping the REAL
 * useOpenChoreoQuery) and drive discovery + fetch through createQueryWrapper.
 *
 * Coverage focus (matching the actual return shape
 * `{ workflowRun, loading, isRefetching, error, refetch }`):
 *   - initial loading=true / workflowRun=null,
 *   - resolved data + error null after settle,
 *   - isRefetching exposed and false after load,
 *   - the `enabled: !!runName` gate,
 *   - refetch() re-invokes the client.
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { useWorkflowRun, type WorkflowRunDetails } from './useWorkflowRun';

// Keep the real useOpenChoreoQuery; only stub entity resolution.
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  ...jest.requireActual('@openchoreo/backstage-plugin-react'),
  useComponentEntityDetails: () => ({
    getEntityDetails: jest.fn().mockResolvedValue({
      componentName: 'test-component',
      projectName: 'test-project',
      namespaceName: 'test-ns',
    }),
  }),
}));

const mockDiscoveryApi = { getBaseUrl: jest.fn() };
const mockFetchApi = { fetch: jest.fn() };

const okJsonResponse = (body: unknown) =>
  ({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => body,
  } as unknown as Response);

const errResponse = (status: number, statusText: string) =>
  ({
    ok: false,
    status,
    statusText,
    json: async () => ({}),
  } as unknown as Response);

function makeRun(
  overrides: Partial<WorkflowRunDetails> = {},
): WorkflowRunDetails {
  return {
    name: 'run-1',
    uuid: 'uuid-1',
    status: 'Succeeded',
    commit: 'abc123',
    ...overrides,
  };
}

function renderWorkflowRun(runName?: string) {
  return renderHook(() => useWorkflowRun(runName), {
    wrapper: createQueryWrapper([
      [discoveryApiRef, mockDiscoveryApi as any],
      [fetchApiRef, mockFetchApi as any],
    ]),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDiscoveryApi.getBaseUrl.mockResolvedValue('http://localhost/ci');
});

describe('useWorkflowRun', () => {
  it('starts loading with no run, then resolves the run details', async () => {
    const run = makeRun();
    mockFetchApi.fetch.mockResolvedValueOnce(okJsonResponse(run));

    const { result } = renderWorkflowRun('run-1');

    // First render: fetching, nothing on screen yet, not a background refresh.
    expect(result.current.loading).toBe(true);
    expect(result.current.workflowRun).toBeNull();
    expect(result.current.isRefetching).toBe(false);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.workflowRun).toEqual(run);
    expect(result.current.error).toBeNull();
    // isRefetching is exposed and settles false after the first load.
    expect(result.current.isRefetching).toBe(false);
  });

  it('hits the ci backend with the expected workflow-run URL', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce(okJsonResponse(makeRun()));

    renderWorkflowRun('run-1');
    await waitFor(() => expect(mockFetchApi.fetch).toHaveBeenCalled());

    expect(mockDiscoveryApi.getBaseUrl).toHaveBeenCalledWith(
      'openchoreo-ci-backend',
    );
    const url = mockFetchApi.fetch.mock.calls[0][0] as string;
    expect(url).toContain('/workflow-run?');
    expect(url).toContain('componentName=test-component');
    expect(url).toContain('projectName=test-project');
    expect(url).toContain('namespaceName=test-ns');
    expect(url).toContain('runName=run-1');
  });

  it('does not load or fetch when runName is undefined (enabled gate)', async () => {
    const { result } = renderWorkflowRun(undefined);

    // Disabled query never spins on the skeleton.
    expect(result.current.loading).toBe(false);
    expect(result.current.workflowRun).toBeNull();
    await waitFor(() => expect(mockFetchApi.fetch).not.toHaveBeenCalled());
  });

  it('surfaces a failed fetch in error and keeps workflowRun null', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce(errResponse(500, 'boom'));

    const { result } = renderWorkflowRun('run-1');

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toContain('500');
    expect(result.current.workflowRun).toBeNull();
  });

  it('refetch() re-invokes the backend', async () => {
    mockFetchApi.fetch
      .mockResolvedValueOnce(okJsonResponse(makeRun({ status: 'Running' })))
      .mockResolvedValueOnce(okJsonResponse(makeRun({ status: 'Succeeded' })));

    const { result } = renderWorkflowRun('run-1');
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.workflowRun?.status).toBe('Running');
    expect(mockFetchApi.fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.refetch();
    });

    await waitFor(() =>
      expect(result.current.workflowRun?.status).toBe('Succeeded'),
    );
    expect(mockFetchApi.fetch).toHaveBeenCalledTimes(2);
  });
});
