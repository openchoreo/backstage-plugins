/**
 * Tests for useWorkflowData.
 *
 * The hook composes TWO independent useOpenChoreoQuery calls:
 *   - builds: openchoreo-workflows-backend `/workflow-runs`, mapped from
 *     `result.items` into the ModelsBuild shape; failures surface in `error`
 *     and this query drives `loading`/`isRefetching`.
 *   - componentDetails: openchoreo `/component`; failures degrade to `null`.
 *
 * We keep the REAL useOpenChoreoQuery and stub only useComponentEntityDetails,
 * drive discovery+fetch through createQueryWrapper, and provide the ambient
 * entity via EntityProvider (the hook calls useEntity() directly for the
 * builds/component query keys).
 *
 * Return shape asserted here:
 *   { builds, componentDetails, loading, isRefetching, error,
 *     fetchBuilds, fetchComponentDetails }
 */
import { ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { mockComponentEntity } from '@openchoreo/test-utils';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { useWorkflowData } from './useWorkflowData';

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

const entity = mockComponentEntity({ name: 'test-component' });

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

// A single WorkflowRun item as returned by the workflows backend.
const runItem = (overrides: Record<string, unknown> = {}) => ({
  name: 'run-1',
  uuid: 'uuid-1',
  status: 'Succeeded',
  createdAt: '2026-05-07T12:00:00Z',
  namespaceName: 'test-ns',
  ...overrides,
});

function wrapper({ children }: { children: ReactNode }) {
  const QueryWrapper = createQueryWrapper([
    [discoveryApiRef, mockDiscoveryApi as any],
    [fetchApiRef, mockFetchApi as any],
  ]);
  return (
    <QueryWrapper>
      <EntityProvider entity={entity}>{children}</EntityProvider>
    </QueryWrapper>
  );
}

/**
 * The builds and component queries fire in parallel and both call
 * discoveryApi.getBaseUrl with a service-specific arg. Route by that arg so a
 * test can seed builds and component responses independently regardless of
 * fetch call order.
 */
function seedFetch(opts: {
  builds?: Response | Error;
  component?: Response | Error;
}) {
  mockDiscoveryApi.getBaseUrl.mockImplementation(async (id: string) =>
    id === 'openchoreo-workflows-backend'
      ? 'http://localhost/workflows'
      : 'http://localhost/openchoreo',
  );
  mockFetchApi.fetch.mockImplementation(async (url: string) => {
    const isBuilds = url.includes('/workflow-runs');
    const outcome = isBuilds ? opts.builds : opts.component;
    if (outcome instanceof Error) throw outcome;
    if (outcome) return outcome;
    // Default: empty-but-ok so the parallel query never rejects unexpectedly.
    return okJsonResponse(isBuilds ? { items: [] } : {});
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useWorkflowData', () => {
  it('starts loading with empty builds/null details, then resolves both', async () => {
    seedFetch({
      builds: okJsonResponse({ items: [runItem()] }),
      component: okJsonResponse({ name: 'test-component', type: 'service' }),
    });

    const { result } = renderHook(() => useWorkflowData(), { wrapper });

    // First render: loading is gated on the builds query; no data yet.
    expect(result.current.loading).toBe(true);
    expect(result.current.builds).toEqual([]);
    expect(result.current.componentDetails).toBeNull();
    expect(result.current.isRefetching).toBe(false);

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Builds are mapped from result.items into the ModelsBuild shape.
    expect(result.current.builds).toHaveLength(1);
    expect(result.current.builds[0]).toMatchObject({
      name: 'run-1',
      status: 'Succeeded',
      componentName: 'test-component',
      projectName: 'test-project',
    });
    expect(result.current.error).toBeNull();

    // componentDetails resolves independently.
    await waitFor(() =>
      expect(result.current.componentDetails).toMatchObject({
        name: 'test-component',
      }),
    );

    // isRefetching is exposed and settles false after the first load.
    expect(result.current.isRefetching).toBe(false);
  });

  it('exposes fetchBuilds and fetchComponentDetails as functions', async () => {
    seedFetch({ builds: okJsonResponse({ items: [] }) });

    const { result } = renderHook(() => useWorkflowData(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(typeof result.current.fetchBuilds).toBe('function');
    expect(typeof result.current.fetchComponentDetails).toBe('function');
  });

  it('degrades componentDetails to null when the component fetch fails, without setting error', async () => {
    seedFetch({
      builds: okJsonResponse({ items: [runItem()] }),
      component: errResponse(500, 'boom'),
    });

    const { result } = renderHook(() => useWorkflowData(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Builds succeeded, so error stays null even though component failed.
    expect(result.current.builds).toHaveLength(1);
    expect(result.current.componentDetails).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('surfaces a failed builds fetch in error', async () => {
    seedFetch({
      builds: errResponse(503, 'unavailable'),
      component: okJsonResponse({}),
    });

    const { result } = renderHook(() => useWorkflowData(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toContain('503');
    expect(result.current.builds).toEqual([]);
  });

  it('fetchBuilds() re-invokes the builds endpoint', async () => {
    seedFetch({ builds: okJsonResponse({ items: [runItem()] }) });

    const { result } = renderHook(() => useWorkflowData(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const buildsCallsBefore = mockFetchApi.fetch.mock.calls.filter(
      ([url]) => typeof url === 'string' && url.includes('/workflow-runs'),
    ).length;

    await act(async () => {
      await result.current.fetchBuilds();
    });

    const buildsCallsAfter = mockFetchApi.fetch.mock.calls.filter(
      ([url]) => typeof url === 'string' && url.includes('/workflow-runs'),
    ).length;
    expect(buildsCallsAfter).toBeGreaterThan(buildsCallsBefore);
  });

  it('fetchComponentDetails() re-invokes the component endpoint', async () => {
    seedFetch({
      builds: okJsonResponse({ items: [] }),
      component: okJsonResponse({ name: 'test-component' }),
    });

    const { result } = renderHook(() => useWorkflowData(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const componentCallsBefore = mockFetchApi.fetch.mock.calls.filter(
      ([url]) => typeof url === 'string' && url.includes('/component'),
    ).length;

    await act(async () => {
      await result.current.fetchComponentDetails();
    });

    const componentCallsAfter = mockFetchApi.fetch.mock.calls.filter(
      ([url]) => typeof url === 'string' && url.includes('/component'),
    ).length;
    expect(componentCallsAfter).toBeGreaterThan(componentCallsBefore);
  });
});
